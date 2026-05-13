import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DbCategory {
  id: string;
  name: string;
  description: string;
}

interface DbSubcategory {
  category_id: string;
  name: string;
}

interface Categorization {
  category: string;
  subcategory: string | null;
}

async function loadCategories(
  supabase: ReturnType<typeof createClient>,
  homeId: string,
): Promise<{ categories: DbCategory[]; subcategories: DbSubcategory[] }> {
  const { data: categories } = await supabase
    .from('shopping_categories')
    .select('id, name, description')
    .eq('home_id', homeId)
    .order('sort_order');

  if (!categories?.length) return { categories: [], subcategories: [] };

  const ids = categories.map((c: DbCategory) => c.id);
  const { data: subcategories } = await supabase
    .from('shopping_subcategories')
    .select('category_id, name')
    .in('category_id', ids)
    .order('sort_order');

  return { categories, subcategories: subcategories ?? [] };
}

function buildPrompt(
  item: string,
  categories: DbCategory[],
  subcategories: DbSubcategory[],
): string {
  const categoryLines = categories.map(cat => {
    const subs = subcategories.filter(s => s.category_id === cat.id);
    let line = `- ${cat.name}`;
    if (cat.description) line += `: ${cat.description}`;
    if (subs.length > 0) {
      line += `\n  Subcategories: ${subs.map(s => s.name).join(', ')}`;
    }
    return line;
  });

  const catsWithSubs = categories.filter(cat =>
    subcategories.some(s => s.category_id === cat.id)
  );
  const subcatInstructions = catsWithSubs.map(cat => {
    const subs = subcategories.filter(s => s.category_id === cat.id).map(s => s.name);
    return `If the category is "${cat.name}", also pick a subcategory from: ${subs.join(', ')}`;
  }).join('\n');

  const fallback = categories.find(c => c.name === 'Misc') ?? categories[categories.length - 1];

  return `Categorize this shopping item into one of the home's categories.

Categories:
${categoryLines.join('\n')}

${subcatInstructions}

If nothing fits, use "${fallback.name}".

Item: "${item}"

Reply with ONLY a JSON object, no markdown. Examples:
{"category":"${categories[0]?.name ?? 'Misc'}"}
${catsWithSubs[0] ? `{"category":"${catsWithSubs[0].name}","subcategory":"${subcategories.find(s => s.category_id === catsWithSubs[0].id)?.name ?? ''}"}` : ''}`;
}

async function categorize(
  item: string,
  homeId: string,
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<Categorization> {
  try {
    const { categories, subcategories } = await loadCategories(supabase, homeId);
    if (!categories.length) return { category: 'Misc', subcategory: null };

    const prompt = buildPrompt(item, categories, subcategories);
    const categoryNames = categories.map(c => c.name);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    if (!res.ok) {
      console.error(`Gemini API error: ${res.status} ${await res.text()}`);
      return { category: categoryNames[categoryNames.length - 1], subcategory: null };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    const parsed = JSON.parse(text);

    const category = categoryNames.includes(parsed.category)
      ? parsed.category
      : (categoryNames.find(n => n === 'Misc') ?? categoryNames[categoryNames.length - 1]);

    const catObj = categories.find(c => c.name === category);
    const validSubs = catObj
      ? subcategories.filter(s => s.category_id === catObj.id).map(s => s.name)
      : [];
    const subcategory = validSubs.includes(parsed.subcategory) ? parsed.subcategory : null;

    return { category, subcategory };
  } catch (e) {
    console.error('Gemini categorize error:', e);
    return { category: 'Misc', subcategory: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  const body = await req.json().catch(() => ({}));
  const name = body.item?.trim();
  const homeId = body.home_id?.trim();
  if (!name) return new Response(JSON.stringify({ error: 'No item provided' }), { status: 400, headers: CORS });
  if (!homeId) return new Response(JSON.stringify({ error: 'No home_id provided' }), { status: 400, headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  const userId = user?.id ?? null;

  // Check purchase history before calling Gemini (filtered by home_id)
  const { data: historyItem } = await supabase
    .from('shopping_items')
    .select('category, subcategory')
    .eq('home_id', homeId)
    .ilike('name', name)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let category: string;
  let subcategory: string | null = null;

  if (historyItem?.category) {
    category = historyItem.category;
    subcategory = historyItem.subcategory ?? null;
  } else {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiKey) {
      const result = await categorize(name, homeId, supabase, geminiKey);
      category = result.category;
      subcategory = result.subcategory;
    } else {
      category = 'Misc';
    }
  }

  const { error } = await supabase.from('shopping_items').insert({
    name, home_id: homeId, user_id: userId, category, subcategory,
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });

  return new Response(JSON.stringify({ ok: true, category, subcategory }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
