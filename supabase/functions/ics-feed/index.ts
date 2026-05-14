import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

const pad = (n: number) => String(n).padStart(2, '0');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return new Response('Missing token', { status: 400, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: setting } = await supabase
    .from('home_settings')
    .select('home_id')
    .eq('key', 'ical_token')
    .eq('value', token)
    .maybeSingle();

  if (!setting) {
    return new Response('Invalid token', { status: 404, headers: CORS });
  }

  const [{ data: events }, { data: home }] = await Promise.all([
    supabase.from('events').select('*').eq('home_id', setting.home_id),
    supabase.from('homes').select('name').eq('id', setting.home_id).maybeSingle(),
  ]);

  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const calName = home?.name ? `Shnoozy – ${home.name}` : 'Shnoozy';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shnoozy//Home Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(calName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  (events || []).forEach(event => {
    const start = new Date(event.start_time);
    let dtstart: string, dtend: string;

    if (event.is_all_day) {
      const ds = `${start.getUTCFullYear()}${pad(start.getUTCMonth() + 1)}${pad(start.getUTCDate())}`;
      dtstart = `DTSTART;VALUE=DATE:${ds}`;
      dtend = `DTEND;VALUE=DATE:${ds}`;
    } else {
      const fmt = (d: Date) =>
        `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
      dtstart = `DTSTART:${fmt(start)}`;
      const end = event.end_time ? new Date(event.end_time) : new Date(start.getTime() + 3600000);
      dtend = `DTEND:${fmt(end)}`;
    }

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@shnoozy.top`,
      `DTSTAMP:${stamp}`,
      dtstart, dtend,
      `SUMMARY:${escapeICS(event.title)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    if (event.recurrence_type === 'yearly') lines.push('RRULE:FREQ=YEARLY');
    if (event.recurrence_type === 'weekly') lines.push('RRULE:FREQ=WEEKLY');
    lines.push(`CATEGORIES:${event.category.toUpperCase()}`, 'END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      ...CORS,
      'Content-Type': 'text/calendar;charset=utf-8',
      'Content-Disposition': `attachment; filename="shnoozy.ics"`,
      'Cache-Control': 'no-cache',
    },
  });
});
