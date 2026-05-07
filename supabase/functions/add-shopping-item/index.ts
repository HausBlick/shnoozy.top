import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CATEGORIES = ['Fruits & Veggies', 'Luna', 'Drogerie', 'Cleaning', 'Groceries', 'Misc'] as const;
const GROCERIES_SUBCATEGORIES = ['Spices', 'Meat', 'Frozen', 'Coffee & Tea', 'Dairy', 'Cans & Boxes', 'Dry Food', 'Drinks', 'Snacks'] as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Categorization {
  category: string;
  subcategory: string | null;
}

async function categorize(item: string, apiKey: string): Promise<Categorization> {
  try {
    const prompt = `Categorize this shopping item into a category and optionally a subcategory.

Top-level categories: Fruits & Veggies, Luna, Drogerie, Cleaning, Groceries, Misc

If the category is "Groceries", also choose a subcategory from: Spices, Meat, Frozen, Coffee & Tea, Dairy, Cans & Boxes, Dry Food, Drinks, Snacks

Category guidelines:
- Fruits & Veggies: fresh fruits and vegetables
- Luna: dog food, treats, dental sticks, pet accessories
- Drogerie: hygiene products, cosmetics, shampoo, soap, deodorant, toilet paper, tissues
- Cleaning: cleaning products, trash bags, detergent, dishwasher tabs, sponges, mop
- Groceries > Spices: spices, herbs, oil, vinegar, sauces, condiments, mustard, ketchup
- Groceries > Meat: meat, fish, sausage, cold cuts, refrigerated convenience meals, Maultaschen
- Groceries > Frozen: frozen pizza, fries, frozen vegetables, frozen fruits, ice cream, frozen meals
- Groceries > Coffee & Tea: coffee, tea, bread, spreads, jam, rolls, pastries
- Groceries > Dairy: butter, yogurt, cream, cheese, eggs, milk, quark
- Groceries > Cans & Boxes: canned beans, chickpeas, corn, olives, passata, tomatoes, stock cubes
- Groceries > Dry Food: pasta, rice, flour, sugar, oats, cereal, lentils, couscous
- Groceries > Drinks: water, juice, soda, beer, wine, spirits, energy drinks
- Groceries > Snacks: chips, chocolate, cookies, candy, nuts, popcorn
- Misc: anything that does not fit the above categories

Item: "${item}"

Reply with ONLY a JSON object, no markdown, no explanation. Examples:
{"category":"Groceries","subcategory":"Dairy"}
{"category":"Fruits & Veggies"}
{"category":"Drogerie"}`;

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
      return { category: 'Misc', subcategory: null };
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    const parsed = JSON.parse(text);
    const category = (CATEGORIES as readonly string[]).includes(parsed.category) ? parsed.category : 'Misc';
    const subcategory = category === 'Groceries' && (GROCERIES_SUBCATEGORIES as readonly string[]).includes(parsed.subcategory)
      ? parsed.subcategory
      : null;
    return { category, subcategory };
  } catch (e) {
    console.error('Gemini categorize error:', e);
    return { category: 'Misc', subcategory: null };
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
  const name = body.item?.trim();
  const homeId = body.home_id?.trim();
  if (!name) {
    return new Response(JSON.stringify({ error: 'No item provided' }), { status: 400, headers: CORS });
  }
  if (!homeId) {
    return new Response(JSON.stringify({ error: 'No home_id provided' }), { status: 400, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Extract user_id from JWT when called from the app
  let userId: string | null = null;
  if (isAuthenticated && authHeader) {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  }

  // Reuse category from purchase history before calling Gemini
  const { data: historyItem } = await supabase
    .from('shopping_items')
    .select('category, subcategory')
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
      const result = await categorize(name, geminiKey);
      category = result.category;
      subcategory = result.subcategory;
    } else {
      category = 'Misc';
    }
  }

  const { error } = await supabase.from('shopping_items').insert({ name, home_id: homeId, user_id: userId, category, subcategory });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, category, subcategory }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
