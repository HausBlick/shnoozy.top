const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INDEX_LABELS: Record<string, { de: string; en: string }> = {
  NONE:       { de: 'Keine',       en: 'None' },
  VERY_LOW:   { de: 'Sehr niedrig', en: 'Very Low' },
  LOW:        { de: 'Niedrig',     en: 'Low' },
  MODERATE:   { de: 'Mäßig',      en: 'Moderate' },
  HIGH:       { de: 'Hoch',       en: 'High' },
  VERY_HIGH:  { de: 'Sehr hoch',  en: 'Very High' },
};

const INDEX_COLORS: Record<number, string> = {
  0: '#9ca3af',
  1: '#22c55e',
  2: '#84cc16',
  3: '#f59e0b',
  4: '#f97316',
  5: '#ef4444',
};

interface PollenType {
  index: number;
  category: string;
  label: { de: string; en: string };
  color: string;
  inSeason: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lat, lon } = await req.json();
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return new Response(JSON.stringify({ error: 'lat and lon required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!mapsKey) {
      return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${mapsKey}&location.longitude=${lon}&location.latitude=${lat}&days=1`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: `Pollen API error: ${res.status}`, detail: body }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await res.json();
    const pollenTypes: Record<string, PollenType> = {};

    for (const pt of json?.dailyInfo?.[0]?.pollenTypeInfo ?? []) {
      const idx: number = pt.indexInfo?.value ?? 0;
      const cat: string = pt.indexInfo?.category ?? 'NONE';
      pollenTypes[pt.code as string] = {
        index: idx,
        category: cat,
        label: INDEX_LABELS[cat] ?? { de: cat, en: cat },
        color: INDEX_COLORS[idx] ?? '#9ca3af',
        inSeason: pt.inSeason ?? false,
      };
    }

    return new Response(JSON.stringify({ types: pollenTypes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
