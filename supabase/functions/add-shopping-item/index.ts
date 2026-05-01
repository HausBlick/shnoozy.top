import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CATEGORIES = ['Groceries', 'Drogerie', 'Cleaning', 'Luna', 'Misc'] as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function categorize(item: string, apiKey: string): Promise<string> {
  try {
    const prompt = `Categorize this shopping item into exactly one of: ${CATEGORIES.join(', ')}.\nItem: "${item}"\nReply with only the category name.`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return (CATEGORIES as readonly string[]).includes(text) ? text : 'Misc';
  } catch {
    return 'Misc';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Auth: either IFTTT secret (query param) or Supabase JWT (Authorization header)
  const url = new URL(req.url);
  const iftttSecret = url.searchParams.get('secret');
  const authHeader = req.headers.get('Authorization');

  const isIFTTT = iftttSecret && iftttSecret === Deno.env.get('IFTTT_SECRET');
  const isAuthenticated = !!authHeader?.startsWith('Bearer ');

  if (!isIFTTT && !isAuthenticated) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  const body = await req.json().catch(() => ({}));
  const title = body.item?.trim();
  if (!title) {
    return new Response(JSON.stringify({ error: 'No item provided' }), { status: 400, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const category = geminiKey ? await categorize(title, geminiKey) : 'Misc';

  const { error } = await supabase.from('shopping_items').insert({ title, category });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, category }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
