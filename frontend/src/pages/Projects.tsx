import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Project } from "../lib/api";

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "#16a34a",
    paused: "#ca8a04",
    archived: "#9ca3af",
  };
  return (
    <span className="status-badge" style={{ background: colors[status] || "#9ca3af" }}>
      {status}
    </span>
  );
}

function downloadProjectMd(project: Project) {
  const commits = project.recent_commits
    .map((c) => `- \`${c.hash}\` ${c.subject} (${formatDate(c.date)})`)
    .join("\n");

  const md = `# ${project.name}

**Status:** ${project.status}
**Time span:** ${formatDate(project.first_commit_at)} — ${formatDate(project.last_commit_at)}

## Summary
${project.description}

## Stats
- ${project.total_commits} commits | ${project.files_changed} files changed | +${project.lines_added} / -${project.lines_removed} lines
- ${project.claude_sessions} Claude Code sessions | ${project.claude_messages} messages

## Recent Commits
${commits}
`;
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.slug}.md`;
  a.click();
  URL.revokeObjectURL(url);
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
        <h1>Coding 项目</h1>
        <div className="filter-bar">
          {["all", "active", "paused"].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "active" ? "活跃" : "暂停"}
              {f !== "all" && ` (${projects.filter((p) => p.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="projects-grid">
        {filtered.map((project) => (
          <div key={project.slug} className="project-card">
            <div className="card-header">
              <Link to={`/projects/${project.slug}`} className="card-title">
                {project.name}
              </Link>
              <StatusBadge status={project.status} />
            </div>

            <p className="card-desc">{project.description.slice(0, 120)}{project.description.length > 120 ? "..." : ""}</p>

            <div className="card-stats">
              <div className="stat">
                <span className="stat-value">{project.total_commits}</span>
                <span className="stat-label">commits</span>
              </div>
              <div className="stat">
                <span className="stat-value">{project.claude_sessions}</span>
                <span className="stat-label">sessions</span>
              </div>
              <div className="stat">
                <span className="stat-value">+{project.lines_added}</span>
                <span className="stat-label">lines</span>
              </div>
            </div>

            <div className="card-timeline">
              {formatDate(project.first_commit_at)} — {formatDate(project.last_commit_at)}
            </div>

            <div className="card-commits">
              {project.recent_commits.slice(0, 3).map((c) => (
                <div key={c.hash} className="commit-item">
                  <code className="commit-hash">{c.hash}</code>
                  <span className="commit-msg">{c.subject}</span>
                </div>
              ))}
            </div>

            <div className="card-actions">
              <Link to={`/projects/${project.slug}`} className="btn btn-sm">
                详情
              </Link>
              <button className="btn btn-sm btn-ghost" onClick={() => downloadProjectMd(project)}>
                导出 .md
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div className="empty">没有找到项目</div>}
    </div>
  );
}
