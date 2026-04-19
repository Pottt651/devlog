import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type DiaryEntry } from "../lib/api";

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function downloadDiaryMd(entry: DiaryEntry) {
  const md = `---
title: "${entry.title}"
date: ${entry.created_at}
tags: [${entry.tags.join(", ")}]
---

${entry.content}
`;
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diary-${entry.id}-${entry.title.slice(0, 20)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Diary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getDiaryEntries().then(setEntries).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("确认删除这篇日记？")) return;
    await api.deleteDiary(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>日记</h1>
        <button className="btn btn-primary" onClick={() => navigate("/diary/new")}>
          + 写日记
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <p>还没有日记，点击上方按钮开始写作</p>
        </div>
      ) : (
        <div className="diary-list">
          {entries.map((entry) => (
            <div key={entry.id} className="diary-card">
              <div className="diary-card-header">
                <Link to={`/diary/${entry.id}/edit`} className="diary-title">
                  {entry.title}
                </Link>
                <span className="diary-date">{formatDate(entry.created_at)}</span>
              </div>

              {entry.tags.length > 0 && (
                <div className="diary-tags">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}

              <p className="diary-preview">
                {entry.content.slice(0, 200)}{entry.content.length > 200 ? "..." : ""}
              </p>

              <div className="card-actions">
                <Link to={`/diary/${entry.id}/edit`} className="btn btn-sm">编辑</Link>
                <button className="btn btn-sm btn-ghost" onClick={() => downloadDiaryMd(entry)}>
                  导出 .md
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(entry.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
