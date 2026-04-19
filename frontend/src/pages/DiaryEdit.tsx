import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";

export default function DiaryEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (id) {
      api.getDiaryEntry(Number(id)).then((entry) => {
        setTitle(entry.title);
        setContent(entry.content);
        setTagsInput(entry.tags.join(", "));
      }).finally(() => setLoading(false));
    }
  }, [id]);

  async function handleSave() {
    if (!title.trim()) return alert("请输入标题");
    setSaving(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      if (isNew) {
        await api.createDiary({ title, content, tags });
      } else {
        await api.updateDiary(Number(id), { title, content, tags });
      }
      navigate("/diary");
    } catch (err) {
      alert("保存失败: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isNew ? "写日记" : "编辑日记"}</h1>
        <div className="header-actions">
          <button
            className={`btn btn-sm ${preview ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setPreview(!preview)}
          >
            {preview ? "编辑" : "预览"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate("/diary")}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      <div className="editor-form">
        <input
          className="editor-title"
          type="text"
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="editor-tags"
          type="text"
          placeholder="标签（逗号分隔，如: 随想, 技术, 生活）"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        {preview ? (
          <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            className="editor-content"
            placeholder="用 Markdown 写你的日记..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
