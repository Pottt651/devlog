import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectNew from "./pages/ProjectNew";
import Diary from "./pages/Diary";
import DiaryEdit from "./pages/DiaryEdit";
import Holdings from "./pages/Holdings";
import Etf from "./pages/Etf";
import Alphamath from "./pages/Alphamath";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon">D</div>
            <div>
              <div className="brand-title">Pott1587</div>
              <div className="brand-sub">个人开发博客</div>
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
            <NavLink to="/holdings" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>
              持仓
            </NavLink>
            <NavLink to="/etf" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
              动量实盘
            </NavLink>
            <NavLink to="/alphamath" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z"/><path d="M8 10h8M8 14h5M10 8v8"/></svg>
              Teacher OS
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
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/ibkr" element={<Holdings />} />
            <Route path="/transactions" element={<Holdings />} />
            <Route path="/etf" element={<Etf />} />
            <Route path="/alphamath" element={<Alphamath />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
