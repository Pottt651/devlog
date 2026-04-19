import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Project } from "../lib/api";

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function downloadProjectMd(project: Project) {
  const commits = project.recent_commits
    .map((c) => `- \`${c.hash}\` ${c.subject} (${formatDate(c.date)})`)
    .join("\n");

  const md = `# ${project.name}

${project.description}

---

**状态：** ${project.status === "active" ? "进行中" : "已暂停"}
**时间跨度：** ${formatDate(project.first_commit_at)} — ${formatDate(project.last_commit_at)}
**提交数：** ${project.total_commits} | **Claude Code 会话：** ${project.claude_sessions}

## 更新记录
${commits || "暂无提交记录"}
`;
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.slug}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      api.getProject(slug).then(setProject).finally(() => setLoading(false));
    }
  }, [slug]);

  if (loading) return <div className="loading">加载中...</div>;
  if (!project) return <div className="empty">项目未找到</div>;

  const statusLabel = project.status === "active" ? "进行中" : project.status === "paused" ? "已暂停" : "已归档";

  return (
    <div className="page">
      <Link to="/projects" className="back-link">← 返回项目列表</Link>

      <div className="detail-hero">
        <h1>{project.name}</h1>
        <span className={`status-pill status-${project.status}`}>{statusLabel}</span>
      </div>

      <p className="detail-description">{project.description}</p>

      {(project.links?.live || project.links?.github) && (
        <div className="detail-links">
          {project.links.live && (
            <a href={project.links.live} target="_blank" rel="noopener noreferrer" className="link-btn link-live">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              在线访问
            </a>
          )}
          {project.links.github && (
            <a href={project.links.github} target="_blank" rel="noopener noreferrer" className="link-btn link-github">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub 仓库
            </a>
          )}
        </div>
      )}

      <div className="detail-info-bar">
        <div className="info-item">
          <span className="info-label">时间跨度</span>
          <span className="info-value">{formatDate(project.first_commit_at)} — {formatDate(project.last_commit_at)}</span>
        </div>
        {project.total_commits > 0 && (
          <div className="info-item">
            <span className="info-label">提交次数</span>
            <span className="info-value">{project.total_commits}</span>
          </div>
        )}
        {project.claude_sessions > 0 && (
          <div className="info-item">
            <span className="info-label">AI 协作会话</span>
            <span className="info-value">{project.claude_sessions} 次对话 · {project.claude_messages} 条消息</span>
          </div>
        )}
      </div>

      <div className="detail-section">
        <div className="section-header">
          <h2>更新记录</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => downloadProjectMd(project)}>
            导出 .md
          </button>
        </div>

        {project.recent_commits.length > 0 ? (
          <div className="timeline">
            {project.recent_commits.map((c) => (
              <div key={c.hash} className="timeline-item">
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <span className="timeline-msg">{c.subject}</span>
                  <span className="timeline-date">{formatDate(c.date)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-inline">暂无提交记录（仅 Claude Code 会话项目）</p>
        )}
      </div>
    </div>
  );
}
