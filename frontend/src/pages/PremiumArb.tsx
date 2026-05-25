import { useEffect, useState, useMemo } from "react";
import "./PremiumArb.css";

type HistoryPoint = {
  date: string;
  premium_pct: number;
  nav: number;
  close: number;
};

type RoundTrip = {
  buy_date: string;
  buy_close: number;
  buy_premium: number;
  sell_date: string;
  sell_close: number;
  sell_premium: number;
  hold_days: number;
  pnl_pct: number;
};

type AvailSymbol = {
  symbol: string; name: string; index_name: string;
  buy_th: number; sell_floor: number;
};

type ApiResponse = {
  symbol: string;
  name: string;
  index_name?: string;
  available_symbols?: AvailSymbol[];
  strategy: {
    version?: string;
    buy_th: number;
    sell_th: number;
    sell_floor?: number;
    sell_rule?: string;
    cost: number;
  };
  // 此时此刻 — 用户最关心的 "现在 premium"
  now?: {
    premium_pct: number | null;
    close: number | null;
    nav: number | null;
    nav_source: string;
    close_source: string | null;
    fetched_at: string;
  };
  latest_eod: { date: string; nav: number; close: number; premium_pct: number };
  latest_nav_source?: {
    date: string;
    nav: number;
    gsz: number | null;
    gszzl: number | null;
    gztime: string | null;
  } | null;
  realtime: {
    price: number;
    pct_change: number;
    prev_close?: number;
  } | null;
  signal: {
    current_state: "in" | "out";
    next_action: string;
    distance_to_sell_pp: number | null;
    distance_to_buy_pp: number | null;
    last_trade: { date: string; action: string; premium: number; close: number } | null;
  };
  open_position: {
    buy_date: string;
    buy_close: number;
    buy_premium: number;
    current_close: number;
    current_premium: number;
    hold_days: number;
    floating_pnl_pct: number;
  } | null;
  round_trips: RoundTrip[];
  stats_recent_60d: {
    mean_60d: number;
    max_60d: number;
    min_60d: number;
    n_above_sellfloor_60d?: number;
    n_above_avg_60d?: number;
    n_above_6_60d?: number;
    n_above_7_60d?: number;
    n_below_0_60d: number;
  };
  history: HistoryPoint[];
  data_freshness?: {
    latest_data_date: string;
    today: string;
    today_is_trading_day: boolean;
    missing_trading_days: number;
    nav_lag_days: number;
    d1_delta_rows: number;
    d1_delta_latest: string | null;
    fundgz_latest_jzrq: string | null;
    warning: string | null;
  };
  generated_at: string;
};

export default function PremiumArb() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  // 当前标的 (默认 159612 SPX, 切换时改变)
  const [symbol, setSymbol] = useState<string>(() => {
    return localStorage.getItem("premium-arb-symbol") || "159612";
  });

  useEffect(() => {
    setLoading(true);
    localStorage.setItem("premium-arb-symbol", symbol);
    fetch(`/api/premium-arb?symbol=${symbol}`)
      .then(async (r) => {
        const body = await r.text();
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${body.slice(0, 1500)}`);
        }
        try {
          return JSON.parse(body);
        } catch (e) {
          throw new Error(`Bad JSON: ${body.slice(0, 1500)}`);
        }
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshTick, symbol]);

  useEffect(() => {
    const t = setInterval(() => setRefreshTick((v) => v + 1), 180000);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) {
    return (
      <div className="page premium-arb">
        <div className="page-header">
          <h1>溢价套利 · 159612 国泰标普500ETF</h1>
        </div>
        <div className="loading-state">载入中...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page premium-arb">
        <div className="page-header">
          <h1>溢价套利</h1>
        </div>
        <div className="error-state">
          <p style={{ marginBottom: 12, fontWeight: 600 }}>加载失败:</p>
          <pre style={{
            whiteSpace: "pre-wrap", wordBreak: "break-all",
            textAlign: "left", fontSize: 12,
            background: "var(--red-bg)", padding: 12,
            borderRadius: 8, maxHeight: 400, overflow: "auto",
          }}>{error}</pre>
          <button className="btn" style={{ marginTop: 12 }}
                  onClick={() => setRefreshTick((v) => v + 1)}>重试</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // 优先显示"此刻"premium (now), 退而求其次最新 EOD
  const now = data.now;
  const realPremium = now?.premium_pct ?? data.latest_eod.premium_pct;
  const isIn = data.signal.current_state === "in";
  const hasRealtime = now?.premium_pct != null;

  return (
    <div className="page premium-arb">
      <div className="page-header">
        <div>
          <h1>溢价套利 · {data.name} ({data.symbol})</h1>
          <div className="sub-header">
            跟踪 {data.index_name ?? "—"} · 策略 {data.strategy.version ?? "V1"} ·
            溢价 &lt; <strong>{data.strategy.buy_th}%</strong> 自动买入 ·
            溢价 &gt; <strong>{data.strategy.sell_th.toFixed(2)}%</strong> 自动卖出
            {data.strategy.sell_rule && (
              <span className="rule-note"> (动态: {data.strategy.sell_rule})</span>
            )}
            <br/>
            单边手续费 0.10% · 每 3 分钟自动刷新
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setRefreshTick((v) => v + 1)}
        >
          ↻ 立即刷新
        </button>
      </div>

      {/* 标的切换 tab */}
      {data.available_symbols && data.available_symbols.length > 1 && (
        <div className="symbol-tabs">
          {data.available_symbols.map((s) => (
            <button
              key={s.symbol}
              className={`symbol-tab ${s.symbol === symbol ? "active" : ""}`}
              onClick={() => setSymbol(s.symbol)}
            >
              <div className="symbol-tab-name">{s.name}</div>
              <div className="symbol-tab-meta">
                {s.symbol} · {s.index_name} · 阈值 {s.buy_th}% / {s.sell_floor}%+
              </div>
            </button>
          ))}
        </div>
      )}

      {/* HERO: 当前 premium + 状态 */}
      <div className="hero-grid">
        <div className={`hero-card ${isIn ? "hero-in" : "hero-out"}`}>
          <div className="hero-label">
            实时溢价率 {hasRealtime ? "🔴 LIVE" : "(暂用最近收盘)"}
          </div>
          <div className="hero-value">
            {realPremium >= 0 ? "+" : ""}
            {realPremium.toFixed(2)}%
          </div>
          <div className="hero-sub">
            {now && now.close != null && now.nav != null
              ? <>实时价 <strong>{now.close.toFixed(3)} 元</strong> ÷ 估算 NAV <strong>{now.nav.toFixed(4)}</strong>
                  {data.realtime?.pct_change !== undefined && <> · 今日涨跌 {data.realtime.pct_change >= 0 ? "+" : ""}{data.realtime.pct_change.toFixed(2)}%</>}
                </>
              : `截止 ${data.latest_eod.date} · 收盘价 ${data.latest_eod.close.toFixed(3)} 元 / 单位净值 ${data.latest_eod.nav.toFixed(4)}`}
          </div>
          <div className="hero-foot">
            价: 腾讯 qt (每秒) · NAV: 东财 fundgz {data.latest_nav_source?.gsz ? "估算净值 gsz" : "T-1 公布"}
            {data.latest_nav_source?.gztime && ` · NAV 更新于 ${data.latest_nav_source.gztime}`}
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-label">当前持仓状态</div>
          <div className={`hero-state-badge ${isIn ? "state-in" : "state-out"}`}>
            {isIn ? "🟢 持仓中" : "⚪ 空仓中"}
          </div>
          <div className="hero-sub">
            {isIn
              ? `等溢价率涨到 ${data.strategy.sell_th.toFixed(2)}% 以上, 自动触发卖出`
              : `等溢价率跌到 ${data.strategy.buy_th}% 以下, 自动触发买入`}
          </div>
          {data.strategy.version === "V5 自适应" && isIn && (
            <div className="hero-foot">
              卖出阈值随市场调整 · 当前 = max({data.strategy.sell_floor}%, 近 60 日 P95) = {data.strategy.sell_th.toFixed(2)}%
            </div>
          )}
        </div>

        <div className="hero-card">
          <div className="hero-label">距离信号触发</div>
          <div className="hero-value-sm">
            {isIn ? (
              <>
                还需溢价率<strong> 上涨 {data.signal.distance_to_sell_pp?.toFixed(2)} 个百分点</strong>
                <br />
                <span className="hero-aux">(到 {data.strategy.sell_th.toFixed(2)}% 卖出阈值)</span>
              </>
            ) : (
              <>
                {data.signal.distance_to_buy_pp! >= 0 ? (
                  <>
                    还需溢价率<strong> 下跌 {data.signal.distance_to_buy_pp?.toFixed(2)} 个百分点</strong>
                    <br />
                    <span className="hero-aux">(到 {data.strategy.buy_th}% 买入阈值)</span>
                  </>
                ) : (
                  <>已低于买入阈值, 下个交易日开盘买入</>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 当前持仓详情 */}
      {data.open_position && (
        <div className="info-card holding-card">
          <div className="info-header">
            <span className="info-title">📦 当前持仓详情</span>
            <span
              className={`pnl-badge ${
                data.open_position.floating_pnl_pct >= 0 ? "pnl-pos" : "pnl-neg"
              }`}
            >
              账面盈亏 {data.open_position.floating_pnl_pct >= 0 ? "+" : ""}
              {data.open_position.floating_pnl_pct.toFixed(2)}%
            </span>
          </div>
          <div className="info-grid">
            <div>
              <div className="info-label">买入日期</div>
              <div className="info-val">{data.open_position.buy_date}</div>
            </div>
            <div>
              <div className="info-label">买入价 (元/份)</div>
              <div className="info-val mono">
                {data.open_position.buy_close.toFixed(3)}
              </div>
            </div>
            <div>
              <div className="info-label">买入时溢价率</div>
              <div className="info-val mono">
                {data.open_position.buy_premium >= 0 ? "+" : ""}
                {data.open_position.buy_premium.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="info-label">已持仓</div>
              <div className="info-val">{data.open_position.hold_days} 天</div>
            </div>
          </div>
        </div>
      )}

      {/* 近 60 日统计 */}
      <div className="stats-grid">
        <div className="stat-cell">
          <div className="stat-label">近 60 日<br/>溢价率均值</div>
          <div className="stat-val">{data.stats_recent_60d.mean_60d.toFixed(2)}%</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">近 60 日<br/>溢价率最高</div>
          <div className="stat-val text-red">{data.stats_recent_60d.max_60d.toFixed(2)}%</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">近 60 日<br/>溢价率最低</div>
          <div className="stat-val text-green">{data.stats_recent_60d.min_60d.toFixed(2)}%</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">近 60 日<br/>溢价 &gt; 卖出底线 ({data.strategy.sell_floor}%) 天数</div>
          <div className="stat-val">{data.stats_recent_60d.n_above_sellfloor_60d ?? data.stats_recent_60d.n_above_6_60d ?? 0}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">近 60 日<br/>溢价 &gt; 0% 天数</div>
          <div className="stat-val">{data.stats_recent_60d.n_above_avg_60d ?? "—"}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">近 60 日<br/>折价 (&lt;0%) 天数</div>
          <div className="stat-val">{data.stats_recent_60d.n_below_0_60d}</div>
        </div>
      </div>

      {/* 折线图 */}
      <div className="chart-card">
        <div className="chart-title">
          近 {data.history.length} 个交易日溢价率走势
          <span className="chart-subtitle">
            (绿色背景 = 买入区, 灰色 = 持仓观察区, 红色 = 卖出区)
          </span>
        </div>
        <PremiumLineChart
          history={data.history}
          buyTh={data.strategy.buy_th}
          sellTh={data.strategy.sell_th}
          openTrade={data.open_position}
        />
      </div>

      {/* 历史 买→卖 周期 */}
      <div className="trades-card">
        <div className="trades-title">
          历史已完成 买入→卖出 周期 (共 {data.round_trips.length} 次, 胜率{" "}
          {data.round_trips.length > 0
            ? `${Math.round(
                (data.round_trips.filter((r) => r.pnl_pct > 0).length /
                  data.round_trips.length) *
                  100
              )}%`
            : "N/A"})
        </div>
        <table className="trade-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>买入日期</th>
              <th className="right">买入价 (元)</th>
              <th className="right">买入时溢价</th>
              <th>卖出日期</th>
              <th className="right">卖出价 (元)</th>
              <th className="right">卖出时溢价</th>
              <th className="right">持仓天数</th>
              <th className="right">本次盈亏</th>
            </tr>
          </thead>
          <tbody>
            {data.round_trips.map((rt, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="mono">{rt.buy_date}</td>
                <td className="right mono">{rt.buy_close.toFixed(3)}</td>
                <td className="right mono">
                  {rt.buy_premium >= 0 ? "+" : ""}
                  {rt.buy_premium.toFixed(2)}%
                </td>
                <td className="mono">{rt.sell_date}</td>
                <td className="right mono">{rt.sell_close.toFixed(3)}</td>
                <td className="right mono">+{rt.sell_premium.toFixed(2)}%</td>
                <td className="right">{rt.hold_days} 天</td>
                <td className={`right mono ${rt.pnl_pct >= 0 ? "pnl-pos" : "pnl-neg"}`}>
                  {rt.pnl_pct >= 0 ? "+" : ""}
                  {rt.pnl_pct.toFixed(2)}%
                </td>
              </tr>
            ))}
            {data.open_position && (
              <tr className="open-row">
                <td>当前</td>
                <td className="mono">{data.open_position.buy_date}</td>
                <td className="right mono">{data.open_position.buy_close.toFixed(3)}</td>
                <td className="right mono">
                  +{data.open_position.buy_premium.toFixed(2)}%
                </td>
                <td colSpan={3} style={{ color: "var(--text3)", fontStyle: "italic" }}>
                  尚未卖出, 等溢价率涨到 {data.strategy.sell_th.toFixed(2)}% 以上 (动态阈值)
                </td>
                <td className="right">{data.open_position.hold_days} 天</td>
                <td
                  className={`right mono ${
                    data.open_position.floating_pnl_pct >= 0 ? "pnl-pos" : "pnl-neg"
                  }`}
                >
                  {data.open_position.floating_pnl_pct >= 0 ? "+" : ""}
                  {data.open_position.floating_pnl_pct.toFixed(2)}% (账面)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 数据新鲜度警告 */}
      {data.data_freshness?.warning && (
        <div className="freshness-warning">
          ⚠️ {data.data_freshness.warning}
        </div>
      )}

      {/* 数据新鲜度详情 */}
      {data.data_freshness && (
        <div className="freshness-card">
          <div className="freshness-row">
            <span className="info-label">最新数据日</span>
            <span className="info-val mono">{data.data_freshness.latest_data_date}</span>
            <span className="info-label">今日</span>
            <span className="info-val mono">{data.data_freshness.today} ({data.data_freshness.today_is_trading_day ? "交易日" : "非交易日"})</span>
          </div>
          <div className="freshness-row">
            <span className="info-label">D1 累计增量</span>
            <span className="info-val mono">{data.data_freshness.d1_delta_rows} 行</span>
            <span className="info-label">基金最新公布 NAV 日</span>
            <span className="info-val mono">{data.data_freshness.fundgz_latest_jzrq ?? "—"}</span>
          </div>
        </div>
      )}

      <div className="footer-note">
        数据更新于 {new Date(data.generated_at).toLocaleString("zh-CN")}
        <br />
        数据源: 烘焙历史 (968 天回测) + D1 数据库 (每次访问增量保存) + 东方财富 fundgz (最新 NAV) + 腾讯财经 (实时收盘价 + 历史 K 线)
        <br />
        浏览器每 3 分钟自动刷新 · 每次刷新都会从 fundgz/Tencent 拉最新数据并写入 D1 (不会丢失)
      </div>
    </div>
  );
}


// ============================================================
// 内联 SVG 折线图
// ============================================================
function PremiumLineChart({
  history,
  buyTh,
  sellTh,
  openTrade,
}: {
  history: HistoryPoint[];
  buyTh: number;
  sellTh: number;
  openTrade: ApiResponse["open_position"];
}) {
  const W = 800;
  const H = 320;
  const PAD = { top: 20, right: 30, bottom: 40, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const { points, minY, maxY, xPos } = useMemo(() => {
    const prems = history.map((h) => h.premium_pct);
    const minY = Math.min(...prems, -2, buyTh - 2);
    const maxY = Math.max(...prems, sellTh + 2);
    const range = maxY - minY;
    const xPos = (i: number) => PAD.left + (i / (history.length - 1)) * plotW;
    const yPos = (v: number) => PAD.top + ((maxY - v) / range) * plotH;
    const points = history.map((h, i) => ({ x: xPos(i), y: yPos(h.premium_pct), d: h }));
    return { points, minY, maxY, xPos };
  }, [history, buyTh, sellTh, plotW, plotH]);

  const yScale = (v: number) =>
    PAD.top + ((maxY - v) / (maxY - minY)) * plotH;
  const buyY = yScale(buyTh);
  const sellY = yScale(sellTh);
  const zeroY = yScale(0);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const xTicks: { x: number; label: string }[] = [];
  let lastMonth = "";
  history.forEach((h, i) => {
    const month = h.date.slice(0, 7);
    if (month !== lastMonth) {
      xTicks.push({ x: xPos(i), label: month.slice(5) + "月" });
      lastMonth = month;
    }
  });

  const yStep = Math.max(2, Math.ceil((maxY - minY) / 6));
  const yTicks: number[] = [];
  for (let v = Math.ceil(minY / yStep) * yStep; v <= maxY; v += yStep) {
    yTicks.push(v);
  }

  const lastP = points[points.length - 1];

  const buyDate = openTrade?.buy_date;
  const buyIdx = buyDate ? history.findIndex((h) => h.date === buyDate) : -1;
  const buyPoint = buyIdx >= 0 ? points[buyIdx] : null;

  // Hover 状态
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    // 屏幕像素 → viewbox 坐标
    const px = e.clientX - rect.left;
    const svgX = (px / rect.width) * W;
    // 找最近点 (按 x 距离)
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - svgX);
      if (d < minDist) { minDist = d; nearest = i; }
    }
    if (svgX < PAD.left || svgX > W - PAD.right) {
      setHoveredIdx(null);
    } else {
      setHoveredIdx(nearest);
    }
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="premium-chart"
         style={{ cursor: "crosshair" }}
         onMouseMove={handleMouseMove}
         onMouseLeave={() => setHoveredIdx(null)}>
      <rect x={PAD.left} y={PAD.top} width={plotW} height={buyY - PAD.top}
            fill="rgba(45, 122, 78, 0.08)" />
      <rect x={PAD.left} y={buyY} width={plotW} height={sellY - buyY}
            fill="rgba(160, 152, 144, 0.06)" />
      <rect x={PAD.left} y={sellY} width={plotW} height={PAD.top + plotH - sellY}
            fill="rgba(191, 58, 43, 0.10)" />

      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)}
                stroke="rgba(28,24,20,0.06)" strokeWidth={1} />
          <text x={PAD.left - 6} y={yScale(v) + 3} fontSize={10}
                textAnchor="end" fill="var(--text3)">{v}%</text>
        </g>
      ))}

      <line x1={PAD.left} x2={W - PAD.right} y1={buyY} y2={buyY}
            stroke="var(--green)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      <text x={W - PAD.right + 4} y={buyY + 3} fontSize={10} fill="var(--green)">
        买入阈值 {buyTh}%
      </text>
      <line x1={PAD.left} x2={W - PAD.right} y1={sellY} y2={sellY}
            stroke="var(--red)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      <text x={W - PAD.right + 4} y={sellY + 3} fontSize={10} fill="var(--red)">
        卖出阈值 {sellTh}%
      </text>
      <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY}
            stroke="rgba(28,24,20,0.3)" strokeWidth={1} />
      <text x={PAD.left - 6} y={zeroY + 3} fontSize={10}
            textAnchor="end" fill="var(--text3)" fontWeight={600}>0%</text>

      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.8} />

      {buyPoint && (
        <g>
          <circle cx={buyPoint.x} cy={buyPoint.y} r={5}
                  fill="var(--green)" stroke="white" strokeWidth={1.5} />
          <text x={buyPoint.x} y={buyPoint.y - 9} fontSize={10}
                textAnchor="middle" fill="var(--green)" fontWeight={600}>
            买入点 {buyPoint.d.premium_pct >= 0 ? "+" : ""}{buyPoint.d.premium_pct.toFixed(1)}%
          </text>
        </g>
      )}

      <g>
        <circle cx={lastP.x} cy={lastP.y} r={6} fill="var(--accent)"
                stroke="white" strokeWidth={2} />
        <text x={lastP.x} y={lastP.y - 10} fontSize={11}
              textAnchor="end" fill="var(--accent)" fontWeight={700}>
          当前 {lastP.d.premium_pct >= 0 ? "+" : ""}{lastP.d.premium_pct.toFixed(2)}%
        </text>
      </g>

      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={H - PAD.bottom + 16} fontSize={10}
              textAnchor="middle" fill="var(--text3)">{t.label}</text>
      ))}
      <text x={W / 2} y={H - 8} fontSize={11} textAnchor="middle" fill="var(--text3)">
        {history[0]?.date} ~ {history[history.length - 1]?.date}
      </text>

      {/* Hover tooltip — 鼠标悬停时显示 */}
      {hoveredIdx !== null && (() => {
        const p = points[hoveredIdx];
        const d = p.d;
        const isLeftHalf = p.x < W / 2;
        const tipW = 168;
        const tipH = 86;
        const tipPad = 8;
        // tooltip 放在点的对侧, 避免遮挡
        const tipX = isLeftHalf ? p.x + 12 : p.x - tipW - 12;
        const tipY = Math.max(PAD.top, Math.min(p.y - tipH / 2, PAD.top + plotH - tipH));
        return (
          <g pointerEvents="none">
            {/* 垂直引导线 */}
            <line x1={p.x} x2={p.x} y1={PAD.top} y2={PAD.top + plotH}
                  stroke="rgba(28,24,20,0.35)" strokeDasharray="3 3" strokeWidth={1} />
            {/* 高亮点 */}
            <circle cx={p.x} cy={p.y} r={5}
                    fill="var(--accent)" stroke="white" strokeWidth={2} />
            {/* Tooltip 背景 */}
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8}
                  fill="white" stroke="rgba(28,24,20,0.18)" strokeWidth={1}
                  filter="drop-shadow(0 2px 8px rgba(0,0,0,0.12))" />
            {/* Tooltip 文字 */}
            <text x={tipX + tipPad} y={tipY + 18} fontSize={12} fontWeight={700} fill="var(--text)">
              {d.date}
            </text>
            <text x={tipX + tipPad} y={tipY + 38} fontSize={13} fontWeight={700}
                  fill={d.premium_pct > sellTh ? "var(--red)" : (d.premium_pct < buyTh ? "var(--green)" : "var(--accent)")}>
              溢价率 {d.premium_pct >= 0 ? "+" : ""}{d.premium_pct.toFixed(2)}%
            </text>
            <text x={tipX + tipPad} y={tipY + 56} fontSize={11} fill="var(--text2)">
              收盘价 {d.close.toFixed(3)} 元
            </text>
            <text x={tipX + tipPad} y={tipY + 72} fontSize={11} fill="var(--text2)">
              单位净值 {d.nav.toFixed(4)}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
