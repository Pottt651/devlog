interface Env { DB: D1Database; }

// GET /api/projects/:slug
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const slug = params.slug as string;
  const project = await env.DB.prepare(
    "SELECT * FROM projects WHERE slug = ?"
  ).bind(slug).first();

  if (!project) return new Response("Not found", { status: 404 });

  return Response.json({
    ...project,
    recent_commits: JSON.parse((project as any).recent_commits || "[]"),
    links: JSON.parse((project as any).links || "{}"),
    tech_stack: JSON.parse((project as any).tech_stack || "[]"),
    related_projects: JSON.parse((project as any).related_projects || "[]"),
    has_claude_md: !!(project as any).has_claude_md,
    is_manual: !!(project as any).is_manual,
  });
};

// PUT /api/projects/:slug — 更新备注
export const onRequestPut: PagesFunction<Env> = async ({ env, params, request }) => {
  const slug = params.slug as string;
  const body = await request.json() as any;
  await env.DB.prepare("UPDATE projects SET notes = ? WHERE slug = ?").bind(body.notes, slug).run();
  return new Response(null, { status: 204 });
};
