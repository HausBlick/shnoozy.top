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

  // Resolve today and tomorrow in Europe/Berlin time
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

  const { data: allEvents } = await supabase
    .from('events')
    .select('title, category, recurrence_type, start_time');

  const todayTitles: string[] = [];
  const tmrwTitles: string[] = [];

  for (const e of allEvents ?? []) {
    const d = new Date(e.start_time);
    const em = d.getUTCMonth() + 1;
    const ed = d.getUTCDate();
    const dateOnly = e.start_time.slice(0, 10);

    if (e.recurrence_type === 'yearly') {
      if (em === todayM && ed === todayD) todayTitles.push(e.title);
      else if (em === tmrwM && ed === tmrwD) tmrwTitles.push(e.title);
    } else {
      if (dateOnly === todayStr) todayTitles.push(e.title);
      else if (dateOnly === tmrwStr) tmrwTitles.push(e.title);
    }
  }

  const notifications: { title: string; body: string; tag: string }[] = [];
  if (todayTitles.length > 0)
    notifications.push({ title: 'Today 📅', body: todayTitles.join(' · '), tag: 'today' });
  if (tmrwTitles.length > 0)
    notifications.push({ title: 'Tomorrow 🗓️', body: tmrwTitles.join(' · '), tag: 'tomorrow' });

  if (notifications.length === 0)
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  let sent = 0;
  for (const sub of subs ?? []) {
    for (const notif of notifications) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(notif)
        );
        sent++;
      } catch (err: any) {
        // Subscription expired or invalid — clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
