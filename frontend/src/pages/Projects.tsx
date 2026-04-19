import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Project } from "../lib/api";

function formatShortDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "#16a34a",
    paused: "#ca8a04",
    archived: "#9ca3af",
  };
  const labels: Record<string, string> = {
    active: "进行中",
    paused: "已暂停",
    archived: "已归档",
  };
  return (
    <span className="status-dot-wrap">
      <span className="status-dot" style={{ background: colors[status] || "#9ca3af" }} />
      <span className="status-text">{labels[status] || status}</span>
    </span>
  );
}


export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    api.getProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>项目</h1>
        <div className="filter-bar">
          {["all", "active", "paused"].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "active" ? "进行中" : "已暂停"}
              {f !== "all" && ` (${projects.filter((p) => p.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="projects-list">
        {filtered.map((project) => (
          <Link
            to={`/projects/${project.slug}`}
            key={project.slug}
            className="project-card-report"
          >
            <div className="report-top">
              <h2 className="report-title">{project.name}</h2>
              <StatusDot status={project.status} />
            </div>

            <p className="report-desc">{project.description}</p>

            <div className="report-meta">
              <span>{formatShortDate(project.first_commit_at)} — {formatShortDate(project.last_commit_at)}</span>
              {project.total_commits > 0 && <span>{project.total_commits} 次提交</span>}
              {project.claude_sessions > 0 && <span>{project.claude_sessions} 次 AI 协作</span>}
            </div>

            {project.recent_commits.length > 0 && (
              <div className="report-progress">
                <span className="progress-label">最近进展</span>
                <span className="progress-text">
                  {project.recent_commits[0].subject}
                </span>
              </div>
            )}

            {(project.links?.live || project.links?.github) && (
              <div className="report-links" onClick={(e) => e.preventDefault()}>
                {project.links.live && (
                  <a href={project.links.live} target="_blank" rel="noopener noreferrer" className="link-chip link-live" onClick={(e) => e.stopPropagation()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                    在线访问
                  </a>
                )}
                {project.links.github && (
                  <a href={project.links.github} target="_blank" rel="noopener noreferrer" className="link-chip link-github" onClick={(e) => e.stopPropagation()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    GitHub
                  </a>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <div className="empty">没有找到项目</div>}
    </div>
  );
}
