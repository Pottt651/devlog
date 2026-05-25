export default function ClaudeSessions() {
  return (
    <div className="claude-sessions-page">
      <div className="claude-sessions-bar">
        <h1 className="claude-sessions-title">Sessions</h1>
        <a
          href="/sessions.html"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm"
          title="在新窗口打开"
        >
          ↗ 新窗口打开
        </a>
      </div>
      <iframe
        src="/sessions.html"
        title="Claude Code Sessions"
        className="claude-sessions-frame"
        loading="eager"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
