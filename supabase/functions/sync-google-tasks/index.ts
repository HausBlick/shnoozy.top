import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CATEGORIES = ['Groceries', 'Drogerie', 'Cleaning', 'Luna', 'Misc'] as const;

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

Deno.serve(async () => {
  const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')!;
  const listName     = Deno.env.get('GOOGLE_TASK_LIST_NAME') || 'Shopping list';
  const geminiKey    = Deno.env.get('GEMINI_API_KEY');

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
    const title = task.title?.trim();
    if (!title) continue;

    const category = geminiKey ? await categorize(title, geminiKey) : 'Misc';
    const { error } = await supabase.from('shopping_items').insert({ title, category });

    if (!error) {
      await completeTask(accessToken, list.id, task.id);
      imported++;
    }
  }

  return new Response(JSON.stringify({ imported, checked: tasks.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
