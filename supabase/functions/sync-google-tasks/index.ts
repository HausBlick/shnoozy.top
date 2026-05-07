import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CATEGORIES = ['Fruits & Veggies', 'Luna', 'Drogerie', 'Cleaning', 'Groceries', 'Misc'] as const;
const GROCERIES_SUBCATEGORIES = ['Spices', 'Meat', 'Frozen', 'Coffee & Tea', 'Dairy', 'Cans & Boxes', 'Dry Food', 'Drinks', 'Snacks'] as const;

interface Categorization {
  category: string;
  subcategory: string | null;
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function getTaskLists(accessToken: string): Promise<any[]> {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.items || [];
}

async function getPendingTasks(accessToken: string, listId: string): Promise<any[]> {
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=false&showHidden=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.items || [];
}

async function completeTask(accessToken: string, listId: string, taskId: string): Promise<void> {
  await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });
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

Deno.serve(async () => {
  const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')!;
  const listName     = Deno.env.get('GOOGLE_TASK_LIST_NAME') || 'Shopping list';
  const geminiKey    = Deno.env.get('GEMINI_API_KEY');

  const homeId = Deno.env.get('DEFAULT_HOME_ID');
  if (!homeId) return new Response(JSON.stringify({ error: 'DEFAULT_HOME_ID not set' }), { status: 500 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
  const lists = await getTaskLists(accessToken);

  // Find list by name (case-insensitive), fall back to first list
  const list = lists.find(l => l.title.toLowerCase() === listName.toLowerCase()) ?? lists[0];
  if (!list) return new Response(JSON.stringify({ error: 'No task list found' }), { status: 404 });

  const tasks = await getPendingTasks(accessToken, list.id);
  let imported = 0;

  for (const task of tasks) {
    const name = task.title?.trim();
    if (!name) continue;

    const { category, subcategory } = geminiKey
      ? await categorize(name, geminiKey)
      : { category: 'Misc', subcategory: null };

    const { error } = await supabase.from('shopping_items').insert({ name, home_id: homeId, category, subcategory });
    if (!error) {
      await completeTask(accessToken, list.id, task.id);
      imported++;
    }
  }

  return new Response(JSON.stringify({ imported, checked: tasks.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
