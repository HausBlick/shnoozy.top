const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lang = 'de', date } = await req.json();
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isDE = lang === 'de';
    const prompt = isDE
      ? `Schreib ein kurzes, inspirierendes Zitat für den ${date ?? 'heutigen Tag'} auf Deutsch. Maximal 2 Sätze, keine Anführungszeichen, kein Autor, direkt und persönlich ansprechend.`
      : `Write a short, inspiring quote for ${date ?? 'today'} in English. Maximum 2 sentences, no quotation marks, no author, direct and personal.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    const quote = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    return new Response(JSON.stringify({ quote }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
