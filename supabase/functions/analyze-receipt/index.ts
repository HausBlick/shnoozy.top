const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, categories } = await req.json();

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'imageBase64 and mimeType required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const catList: { id: string; name: string }[] = Array.isArray(categories) ? categories : [];
    const catSection = catList.length > 0
      ? `Available expense categories:\n${catList.map(c => `- id="${c.id}" name="${c.name}"`).join('\n')}`
      : 'No categories available.';

    const prompt = `You are a receipt analyser. Look at this receipt image and extract:
1. The total amount paid (the final grand total, as a plain decimal number like 12.50)
2. A short description: the merchant/store name, or if not visible, a brief summary of what was purchased (max 50 characters)
3. The most suitable category ID from the list below, or null if none fits

${catSection}

Respond ONLY with valid JSON in exactly this format — no markdown fences, no extra text:
{"amount": 12.50, "description": "Rewe", "suggested_category_id": "uuid-or-null"}

Rules:
- If you cannot determine the total, use null for amount
- If no category matches well, use null for suggested_category_id
- The suggested_category_id must be one of the IDs listed above, or null`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Gemini response');

    const parsed = JSON.parse(jsonMatch[0]);

    const validCatId = catList.find(c => c.id === parsed.suggested_category_id)?.id ?? null;

    return new Response(JSON.stringify({
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 50) : '',
      suggested_category_id: validCatId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('analyze-receipt error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
