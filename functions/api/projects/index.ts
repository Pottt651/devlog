interface Env { DB: D1Database; }

// GET /api/projects
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT * FROM projects ORDER BY last_commit_at DESC"
  ).all();

  const projects = results.map((r: any) => ({
    ...r,
    recent_commits: JSON.parse(r.recent_commits || "[]"),
    links: JSON.parse(r.links || "{}"),
    tech_stack: JSON.parse(r.tech_stack || "[]"),
    related_projects: JSON.parse(r.related_projects || "[]"),
    has_claude_md: !!r.has_claude_md,
    is_manual: !!r.is_manual,
  }));

  return Response.json(projects);
};

// POST /api/projects — 手动创建项目
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = await request.json() as any;
  const { slug, name, description = "", tech_stack = [], links = {}, notes = "" } = body;
  if (!slug || !name) return new Response("slug and name required", { status: 400 });

  const result = await env.DB.prepare(
    "INSERT INTO projects (slug, name, description, tech_stack, links, notes, is_manual, status) VALUES (?, ?, ?, ?, ?, ?, 1, 'idea') RETURNING *"
  ).bind(slug, name, description, JSON.stringify(tech_stack), JSON.stringify(links), notes).first();

  return Response.json({
    ...result,
    tech_stack: JSON.parse((result as any).tech_stack || "[]"),
    related_projects: JSON.parse((result as any).related_projects || "[]"),
    recent_commits: JSON.parse((result as any).recent_commits || "[]"),
    links: JSON.parse((result as any).links || "{}"),
    has_claude_md: !!(result as any).has_claude_md,
    is_manual: true,
  }, { status: 201 });
};
