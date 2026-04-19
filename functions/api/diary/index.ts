// /api/diary — 日记 CRUD
interface Env {
  DB: D1Database;
}

// GET /api/diary
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const tag = url.searchParams.get("tag");

  let query = "SELECT * FROM diary_entries ORDER BY created_at DESC";
  const { results } = await env.DB.prepare(query).all();

  let entries = results.map((r: any) => ({
    ...r,
    tags: JSON.parse(r.tags || "[]"),
  }));

  if (tag) {
    entries = entries.filter((e: any) => e.tags.includes(tag));
  }

  return Response.json(entries);
};

// POST /api/diary
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = await request.json() as any;
  const { title, content = "", tags = [] } = body;

  if (!title) {
    return new Response("Title required", { status: 400 });
  }

  const result = await env.DB.prepare(
    "INSERT INTO diary_entries (title, content, tags) VALUES (?, ?, ?) RETURNING *"
  ).bind(title, content, JSON.stringify(tags)).first();

  return Response.json({ ...result, tags: JSON.parse((result as any).tags || "[]") }, { status: 201 });
};
