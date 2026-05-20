import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  webpush.setVapidDetails(
    `mailto:${Deno.env.get('VAPID_EMAIL')}`,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  const berlinNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const todayM = berlinNow.getMonth() + 1;
  const todayD = berlinNow.getDate();
  const todayY = berlinNow.getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${todayY}-${pad(todayM)}-${pad(todayD)}`;

  const tmrw = new Date(berlinNow);
  tmrw.setDate(tmrw.getDate() + 1);
  const tmrwM = tmrw.getMonth() + 1;
  const tmrwD = tmrw.getDate();
  const tmrwStr = `${tmrw.getFullYear()}-${pad(tmrwM)}-${pad(tmrwD)}`;

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key, user_id');

  if (!subs || subs.length === 0)
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });

  const userIds = [...new Set(subs.map(s => s.user_id))];

  // Resolve each user's home_id — only notifications from their own home
  const { data: memberships } = await supabase
    .from('home_members')
    .select('user_id, home_id')
    .in('user_id', userIds);

  const userHomeId = new Map<string, string>(
    (memberships ?? []).map((m: { user_id: string; home_id: string }) => [m.user_id, m.home_id])
  );
  const homeIds = [...new Set((memberships ?? []).map((m: { home_id: string }) => m.home_id))];

  if (homeIds.length === 0)
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });

  const [profilesRes, eventsRes, dueTodayRes] = await Promise.all([
    supabase.from('profiles').select('id, notification_preferences').in('id', userIds),
    supabase.from('events')
      .select('title, recurrence_type, start_time, home_id')
      .in('home_id', homeIds),
    supabase.from('todo_items')
      .select('title, assigned_to, home_id')
      .not('assigned_to', 'is', null)
      .eq('done', false)
      .eq('due_date', todayStr)
      .in('home_id', homeIds),
  ]);

  const prefMap = new Map(
    (profilesRes.data ?? []).map((p: { id: string; notification_preferences: unknown }) =>
      [p.id, (p.notification_preferences ?? {}) as Record<string, boolean>])
  );

  // Build per-home event lists for today/tomorrow
  const eventsByHome = new Map<string, { today: string[]; tomorrow: string[] }>();
  for (const e of eventsRes.data ?? []) {
    if (!eventsByHome.has(e.home_id)) eventsByHome.set(e.home_id, { today: [], tomorrow: [] });
    const he = eventsByHome.get(e.home_id)!;
    const d = new Date(e.start_time);
    const em = d.getUTCMonth() + 1;
    const ed = d.getUTCDate();
    const dateOnly = e.start_time.slice(0, 10);
    if (e.recurrence_type === 'yearly') {
      if (em === todayM && ed === todayD) he.today.push(e.title);
      else if (em === tmrwM && ed === tmrwD) he.tomorrow.push(e.title);
    } else {
      if (dateOnly === todayStr) he.today.push(e.title);
      else if (dateOnly === tmrwStr) he.tomorrow.push(e.title);
    }
  }

  // Build per-user due-today map
  const dueByUser = new Map<string, string[]>();
  for (const task of dueTodayRes.data ?? []) {
    const uid = task.assigned_to as string;
    if (!dueByUser.has(uid)) dueByUser.set(uid, []);
    dueByUser.get(uid)!.push(task.title);
  }

  let sent = 0;

  for (const sub of subs) {
    const homeId = userHomeId.get(sub.user_id);
    if (!homeId) continue; // user has no home membership — skip

    const prefs = prefMap.get(sub.user_id) ?? {};
    const wantsCalendar = prefs.calendar_daily !== false;
    const wantsDueToday = prefs.todo_due_today !== false;

    const homeEvents = eventsByHome.get(homeId) ?? { today: [], tomorrow: [] };
    const notifications: { title: string; body: string; tag: string }[] = [];

    if (wantsCalendar) {
      if (homeEvents.today.length > 0)
        notifications.push({ title: 'Today 📅', body: homeEvents.today.join(' · '), tag: 'today' });
      if (homeEvents.tomorrow.length > 0)
        notifications.push({ title: 'Tomorrow 🗓️', body: homeEvents.tomorrow.join(' · '), tag: 'tomorrow' });
    }

    if (wantsDueToday) {
      const dueTasks = dueByUser.get(sub.user_id);
      if (dueTasks && dueTasks.length > 0)
        notifications.push({ title: '✅ Due today', body: dueTasks.join(' · '), tag: 'due-today' });
    }

    for (const notif of notifications) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify(notif)
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
