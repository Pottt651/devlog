import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
}

export default function ProjectNew() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [techInput, setTechInput] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function onNameChange(val: string) {
    setName(val);
    if (!slug || slug === toSlug(name)) {
      setSlug(toSlug(val));
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !slug.trim()) return alert("名称和标识不能为空");
    setSaving(true);
    try {
      const tech_stack = techInput.split(",").map((t) => t.trim()).filter(Boolean);
      await api.createProject({ slug, name, description, tech_stack, notes });
      navigate(`/projects/${slug}`);
    } catch (err) {
      alert("创建失败: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <Link to="/projects" className="back-link">← 返回项目列表</Link>
      <h1 style={{ marginBottom: 24 }}>新建项目</h1>
      <div className="project-form">
        <label>项目名称</label>
        <input type="text" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="如：我的新项目" />
        <label>标识 (slug)</label>
        <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-project" />
        <label>项目简介</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="这个项目做什么..." rows={3} />
        <label>技术栈（逗号分隔）</label>
        <input type="text" value={techInput} onChange={(e) => setTechInput(e.target.value)} placeholder="Python, React, FastAPI" />
        <label>备注 / 灵感</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="记录你的想法..." rows={6} />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "创建中..." : "创建项目"}
        </button>
      </div>
    </div>
  );
}
