import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

interface RequestBody {
  item_id: string;
  assigned_to: string;
  title: string;
  home_id: string;
}

Deno.serve(async (req) => {
  try {
    const body: RequestBody = await req.json();
    const { assigned_to, title } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_EMAIL')}`,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!
    );

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', assigned_to);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    const payload = JSON.stringify({
      title: '✅ New task assigned',
      body: title,
      tag: 'todo-assignment',
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        sent++;
      } catch {}
    }

    return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
