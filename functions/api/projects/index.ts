// GET /api/projects — 返回所有项目
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT * FROM projects ORDER BY last_commit_at DESC"
  ).all();

  const projects = results.map((r: any) => ({
    ...r,
    recent_commits: JSON.parse(r.recent_commits || "[]"),
    links: JSON.parse(r.links || "{}"),
  }));

  return Response.json(projects);
};
