import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectNew from "./pages/ProjectNew";
import Diary from "./pages/Diary";
import DiaryEdit from "./pages/DiaryEdit";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon">D</div>
            <div>
              <div className="brand-title">Devlog</div>
              <div className="brand-sub">quant · 汤</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/projects" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
              项目
            </NavLink>
            <NavLink to="/diary" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              日记
            </NavLink>
          </nav>
          <div className="sidebar-footer">
            Personal Dev Blog
          </div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/new" element={<ProjectNew />} />
            <Route path="/projects/:slug" element={<ProjectDetail />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/diary/new" element={<DiaryEdit />} />
            <Route path="/diary/:id/edit" element={<DiaryEdit />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
