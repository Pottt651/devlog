import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Project } from "../lib/api";

function formatShortDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

const statusColors: Record<string, string> = { active: "#16a34a", paused: "#ca8a04", idea: "#6366f1", archived: "#9ca3af" };
const statusLabels: Record<string, string> = { active: "进行中", paused: "已暂停", idea: "灵感", archived: "已归档" };

function projectUrl(slug: string) {
  return `/projects/${encodeURIComponent(slug)}`;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    api.getProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  async function handleDelete(slug: string, name: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`确认删除「${name}」？`)) return;
    await api.deleteProject(slug);
    setProjects((prev) => prev.filter((p) => p.slug !== slug));
  }

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  // 分组：active 项目大卡片在上，其他项目紧凑网格在下
  const activeProjects = filtered.filter((p) => p.status === "active");
  const otherProjects = filtered.filter((p) => p.status !== "active");

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>项目</h1>
        <div className="header-actions">
          <div className="filter-bar">
            {["all", "active", "paused", "idea"].map((f) => (
              <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "全部" : statusLabels[f]}
                {f !== "all" && ` (${projects.filter((p) => p.status === f).length})`}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/projects/new")}>+ 新建</button>
        </div>
      </div>

      {/* 活跃项目 — 大卡片 */}
      {activeProjects.length > 0 && (
        <>
          {filter === "all" && <h3 className="section-label">活跃项目</h3>}
          <div className="projects-grid-2col">
            {activeProjects.map((p) => (
              <Link to={projectUrl(p.slug)} key={p.slug} className="project-card-report">
                <div className="report-top">
                  <h2 className="report-title">{p.name}</h2>
                  <span className="status-dot" style={{ background: statusColors[p.status] }} />
                </div>
                <p className="report-desc">{p.description}</p>
                {p.tech_stack?.length > 0 && (
                  <div className="tech-tags">
                    {p.tech_stack.map((t) => <span key={t} className="tech-tag">{t}</span>)}
                  </div>
                )}
                {p.recent_commits?.length > 0 && (
                  <div className="report-progress">
                    <span className="progress-label">最近</span>
                    <span className="progress-text">{p.recent_commits[0].subject}</span>
                  </div>
                )}
                {(p.links?.live || p.links?.github) && (
                  <div className="report-links" onClick={(e) => e.preventDefault()}>
                    {p.links.live && (
                      <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="link-chip link-live" onClick={(e) => e.stopPropagation()}>在线</a>
                    )}
                    {p.links.github && (
                      <a href={p.links.github} target="_blank" rel="noopener noreferrer" className="link-chip link-github" onClick={(e) => e.stopPropagation()}>GitHub</a>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 其他项目 — 紧凑网格 */}
      {otherProjects.length > 0 && (
        <>
          {filter === "all" && activeProjects.length > 0 && <h3 className="section-label">其他项目</h3>}
          <div className="projects-grid-3col">
            {otherProjects.map((p) => (
              <Link to={projectUrl(p.slug)} key={p.slug} className="project-card-compact">
                <div className="compact-top">
                  <span className="compact-title">{p.name}</span>
                  <div className="compact-right">
                    <span className="status-dot" style={{ background: statusColors[p.status] }} />
                    {p.is_manual && (
                      <button className="delete-x" onClick={(e) => handleDelete(p.slug, p.name, e)} title="删除">×</button>
                    )}
                  </div>
                </div>
                {p.description && <p className="compact-desc">{p.description.slice(0, 60)}{p.description.length > 60 ? "..." : ""}</p>}
                {p.tech_stack?.length > 0 && (
                  <div className="tech-tags compact-tags">
                    {p.tech_stack.slice(0, 3).map((t) => <span key={t} className="tech-tag">{t}</span>)}
                  </div>
                )}
                <div className="compact-meta">
                  <span style={{ color: statusColors[p.status] }}>{statusLabels[p.status]}</span>
                  {p.total_commits > 0 && <span>{p.total_commits} commits</span>}
                  {p.first_commit_at && <span>{formatShortDate(p.first_commit_at)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 && <div className="empty">没有找到项目</div>}
    </div>
  );
}
