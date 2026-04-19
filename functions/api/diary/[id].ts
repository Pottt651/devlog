// /api/diary/:id — 单条日记操作
interface Env {
  DB: D1Database;
}

// GET /api/diary/:id
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string;
  const entry = await env.DB.prepare(
    "SELECT * FROM diary_entries WHERE id = ?"
  ).bind(id).first();

  if (!entry) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json({ ...entry, tags: JSON.parse((entry as any).tags || "[]") });
};

// PUT /api/diary/:id
export const onRequestPut: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = params.id as string;
  const body = await request.json() as any;
  const { title, content, tags } = body;

  const existing = await env.DB.prepare(
    "SELECT * FROM diary_entries WHERE id = ?"
  ).bind(id).first();

  if (!existing) {
    return new Response("Not found", { status: 404 });
  }

  const newTitle = title ?? (existing as any).title;
  const newContent = content ?? (existing as any).content;
  const newTags = tags !== undefined ? JSON.stringify(tags) : (existing as any).tags;

  const result = await env.DB.prepare(
    "UPDATE diary_entries SET title = ?, content = ?, tags = ?, updated_at = datetime('now') WHERE id = ? RETURNING *"
  ).bind(newTitle, newContent, newTags, id).first();

  return Response.json({ ...result, tags: JSON.parse((result as any).tags || "[]") });
};

// DELETE /api/diary/:id
export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string;
  await env.DB.prepare("DELETE FROM diary_entries WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204 });
};
