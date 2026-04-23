import { useState } from "react";

const DASHBOARD_ORIGIN = "https://cash.pott1587.xyz";

type Tab = { key: string; label: string; path: string };

const TABS: Tab[] = [
  { key: "holdings", label: "持仓", path: "/holdings" },
  { key: "ibkr", label: "IBKR 总览", path: "/ibkr" },
  { key: "transactions", label: "交易流水", path: "/transactions" },
];

export default function Holdings() {
  const [active, setActive] = useState<string>("holdings");
  const tab = TABS.find((t) => t.key === active) ?? TABS[0];
  const src = `${DASHBOARD_ORIGIN}${tab.path}`;

  return (
    <div className="holdings-page">
      <div className="holdings-header">
        <div>
          <h1>我的持仓</h1>
          <div className="holdings-sub">
            来自 CashPilot 财务 · IBKR + D1 实时同步
          </div>
        </div>
        <div className="header-actions">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            title="在新窗口打开"
          >
            ↗ 新窗口打开
          </a>
        </div>
      </div>

      <div className="holdings-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`filter-btn ${active === t.key ? "active" : ""}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="holdings-frame-wrap">
        <iframe
          key={tab.key}
          src={src}
          title={tab.label}
          className="holdings-frame"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
