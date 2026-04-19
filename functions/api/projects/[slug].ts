// GET /api/projects/:slug — 单个项目详情
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const slug = params.slug as string;
  const project = await env.DB.prepare(
    "SELECT * FROM projects WHERE slug = ?"
  ).bind(slug).first();

  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json({
    ...project,
    recent_commits: JSON.parse((project as any).recent_commits || "[]"),
  });
};
