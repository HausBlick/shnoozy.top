import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function unescapeICS(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseDT(value: string, params: string): { time: string; isAllDay: boolean } | null {
  try {
    const v = value.trim();
    if (params.toUpperCase().includes('VALUE=DATE') || /^\d{8}$/.test(v)) {
      const y = v.slice(0, 4), mo = v.slice(4, 6), d = v.slice(6, 8);
      return { time: `${y}-${mo}-${d}T00:00:00.000Z`, isAllDay: true };
    }
    if (/^\d{8}T\d{6}/.test(v)) {
      const y = v.slice(0, 4), mo = v.slice(4, 6), d = v.slice(6, 8);
      const h = v.slice(9, 11), mi = v.slice(11, 13), s = v.slice(13, 15) || '00';
      const utc = v.toUpperCase().endsWith('Z');
      return { time: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${utc ? 'Z' : '+01:00'}`).toISOString(), isAllDay: false };
    }
    return null;
  } catch {
    return null;
  }
}

interface ParsedEvent {
  uid: string;
  title: string;
  startTime: string;
  endTime: string | null;
  isAllDay: boolean;
  description: string | null;
}

function parseICS(text: string): ParsedEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events: ParsedEvent[] = [];
  let inVEvent = false;
  let uid = '', title = '', description = '';
  let dtstart = '', dtstartParams = '', dtend = '';

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inVEvent = true;
      uid = ''; title = ''; description = '';
      dtstart = ''; dtstartParams = ''; dtend = '';
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inVEvent && uid && dtstart) {
        const start = parseDT(dtstart, dtstartParams);
        if (start) {
          const end = dtend ? parseDT(dtend, '') : null;
          events.push({ uid, title: title || '(no title)', startTime: start.time, endTime: end?.time ?? null, isAllDay: start.isAllDay, description: description || null });
        }
      }
      inVEvent = false;
      continue;
    }
    if (!inVEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const propFull = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const semiIdx = propFull.indexOf(';');
    const propName = (semiIdx === -1 ? propFull : propFull.slice(0, semiIdx)).toUpperCase();
    const params = semiIdx === -1 ? '' : propFull.slice(semiIdx + 1);

    switch (propName) {
      case 'UID': uid = value; break;
      case 'SUMMARY': title = unescapeICS(value); break;
      case 'DESCRIPTION': description = unescapeICS(value); break;
      case 'DTSTART': dtstart = value; dtstartParams = params; break;
      case 'DTEND': dtend = value; break;
    }
  }

  return events.slice(0, 2000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let subscriptionId: string | null = null;
  try { const body = await req.json(); subscriptionId = body?.subscription_id ?? null; } catch {}

  const baseQuery = supabase.from('calendar_subscriptions').select('*');
  const { data: subs, error: subError } = await (subscriptionId ? baseQuery.eq('id', subscriptionId) : baseQuery);
  if (subError) return new Response(JSON.stringify({ error: subError.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const results: { id: string; synced: number; error?: string }[] = [];

  for (const sub of (subs || [])) {
    try {
      const resp = await fetch(sub.ics_url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Shnoozy-Calendar/1.0' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const parsed = parseICS(text);

      await supabase.from('external_events').delete().eq('subscription_id', sub.id);

      if (parsed.length > 0) {
        const rows = parsed.map(e => ({
          subscription_id: sub.id,
          home_id: sub.home_id,
          uid: e.uid,
          title: e.title,
          start_time: e.startTime,
          end_time: e.endTime,
          is_all_day: e.isAllDay,
          description: e.description,
        }));
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabase.from('external_events').insert(rows.slice(i, i + 200));
          if (error) throw error;
        }
      }

      await supabase.from('calendar_subscriptions').update({ last_synced_at: new Date().toISOString() }).eq('id', sub.id);
      results.push({ id: sub.id, synced: parsed.length });
    } catch (e: any) {
      results.push({ id: sub.id, synced: 0, error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
