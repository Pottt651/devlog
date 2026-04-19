import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Project } from "../lib/api";

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
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

  return (
    <div className="page">
      <Link to="/projects" className="back-link">← 返回项目列表</Link>

      <div className="detail-header">
        <h1>{project.name}</h1>
        <span className={`status-badge status-${project.status}`}>{project.status}</span>
      </div>

      <p className="detail-desc">{project.description}</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{project.total_commits}</div>
          <div className="stat-label">总提交</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.claude_sessions}</div>
          <div className="stat-label">Claude 会话</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.claude_messages}</div>
          <div className="stat-label">消息数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.files_changed}</div>
          <div className="stat-label">文件变更</div>
        </div>
        <div className="stat-card">
          <div className="stat-value green">+{project.lines_added}</div>
          <div className="stat-label">增加行</div>
        </div>
        <div className="stat-card">
          <div className="stat-value red">-{project.lines_removed}</div>
          <div className="stat-label">删除行</div>
        </div>
      </div>

      <div className="detail-timeline">
        首次活跃: {formatDate(project.first_commit_at)} · 最近活跃: {formatDate(project.last_commit_at)}
      </div>

      <h2>提交历史</h2>
      <div className="commits-table">
        {project.recent_commits.map((c) => (
          <div key={c.hash} className="commit-row">
            <code className="commit-hash">{c.hash}</code>
            <span className="commit-msg">{c.subject}</span>
            <span className="commit-date">{formatDate(c.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
