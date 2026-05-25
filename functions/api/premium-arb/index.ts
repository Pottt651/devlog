/// <reference types="@cloudflare/workers-types" />
// 溢价套利实时信号 — 支持多标的
// 路由: /api/premium-arb?symbol=159612 (默认) 或 ?symbol=159659
//
// 数据策略 (混合保证实时):
//   1. baked HISTORY (per-symbol) — 历史长样本基准
//   2. D1 premium_history 表 — HISTORY 之后每天的增量 (每次调用都 upsert)
//   3. fundgz.1234567.com.cn/{code}.js — 实时估算 NAV (gsz)
//   4. qt.gtimg.cn?q={exchange}{code} — 实时盘中价 (每秒)
//   5. web.ifzq.gtimg.cn (Tencent K-line) — 历史 close (兜底 + 多日)
//
// 实时溢价率 = (Tencent 实时价 − fundgz.gsz 估算 NAV) / fundgz.gsz × 100%
// 策略 V5: 买入 < buy_th; 卖出 > max(sell_floor, 过去 60 日 P95)

import { getConfig, listSymbols, type SymbolConfig } from "./config";

interface Env { DB: D1Database; }

interface PremiumPoint {
  date: string; nav: number; close: number; premium_pct: number;
}
type Trade = {
  date: string; action: "BUY" | "SELL";
  premium: number; close: number;
  hold_days?: number; pnl_pct?: number;
};

// ============================================================
// 数据源 (按 cfg.symbol 区分)
// ============================================================

async function fetchLatestNavViaFundgz(cfg: SymbolConfig): Promise<{
  jzrq: string; dwjz: number;
  gsz: number | null; gszzl: number | null; gztime: string | null;
  real_name: string | null;  // 基金真实名字 (官方权威), 用于覆盖 config 的 hardcoded name
} | null> {
  for (const proto of ["https", "http"]) {
    try {
      const url = `${proto}://fundgz.1234567.com.cn/js/${cfg.symbol}.js?rt=${Date.now()}`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://fund.eastmoney.com/" },
      });
      if (!resp.ok) continue;
      const text = await resp.text();
      const m = text.match(/jsonpgz\((.+)\)/);
      if (!m) continue;
      const data = JSON.parse(m[1]);
      return {
        jzrq: data.jzrq, dwjz: parseFloat(data.dwjz),
        gsz: data.gsz ? parseFloat(data.gsz) : null,
        gszzl: data.gszzl ? parseFloat(data.gszzl) : null,
        gztime: data.gztime || null,
        real_name: data.name || null,
      };
    } catch { continue; }
  }
  return null;
}

async function fetchCloseHistoryTencent(cfg: SymbolConfig, days = 30): Promise<{ date: string; close: number }[]> {
  try {
    const code = `${cfg.exchange_prefix}${cfg.symbol}`;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=${code},day,,,${days},`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = (await resp.json()) as any;
    const items: any[] = json?.data?.[code]?.day || [];
    return items.map((it: any[]) => ({ date: it[0], close: parseFloat(it[2]) }));
  } catch { return []; }
}

async function fetchRealtimeFromTencent(cfg: SymbolConfig): Promise<{
  price: number; pct_change: number; prev_close: number;
} | null> {
  try {
    const code = `${cfg.exchange_prefix}${cfg.symbol}`;
    const url = `https://qt.gtimg.cn/q=${code}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const text = await resp.text();
    const m = text.match(/="(.+?)"/);
    if (!m) return null;
    const parts = m[1].split("~");
    return {
      price: parseFloat(parts[3]),
      prev_close: parseFloat(parts[4]),
      pct_change: parseFloat(parts[32]),
    };
  } catch { return null; }
}

// ============================================================
// D1
// ============================================================

async function readDeltaFromD1(env: Env, symbol: string, afterDate: string): Promise<PremiumPoint[]> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT date, nav, close, premium_pct FROM premium_history WHERE symbol = ? AND date > ? ORDER BY date ASC"
    ).bind(symbol, afterDate).all();
    return (results as any[]).map((r) => ({
      date: r.date, nav: r.nav, close: r.close, premium_pct: r.premium_pct,
    }));
  } catch (e) {
    console.error("D1 read failed", e);
    return [];
  }
}

async function upsertD1Rows(env: Env, symbol: string, rows: PremiumPoint[]): Promise<number> {
  if (rows.length === 0) return 0;
  let count = 0;
  for (const r of rows) {
    try {
      await env.DB.prepare(
        "INSERT OR REPLACE INTO premium_history (symbol, date, nav, close, premium_pct, source, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).bind(symbol, r.date, r.nav, r.close, r.premium_pct, "fundgz+tencent").run();
      count++;
    } catch (e) {
      console.error("D1 upsert failed", e);
    }
  }
  return count;
}

async function fetchNewRows(cfg: SymbolConfig, latestKnownDate: string): Promise<PremiumPoint[]> {
  const closeList = await fetchCloseHistoryTencent(cfg, 30);
  if (closeList.length === 0) return [];
  const fundgz = await fetchLatestNavViaFundgz(cfg);
  if (!fundgz) return [];

  const newRows: PremiumPoint[] = [];
  for (const c of closeList) {
    if (c.date <= latestKnownDate) continue;
    if (c.date === fundgz.jzrq) {
      const prem = ((c.close - fundgz.dwjz) / fundgz.dwjz) * 100;
      if (Math.abs(prem) <= 30) {
        newRows.push({
          date: c.date, nav: fundgz.dwjz, close: c.close,
          premium_pct: prem,
        });
      }
    }
  }
  return newRows;
}

// ============================================================
// 策略 V5
// ============================================================

function buildBakedHistory(cfg: SymbolConfig): PremiumPoint[] {
  return cfg.history.map((r) => ({
    date: r.date, nav: r.nav, close: r.close,
    premium_pct: ((r.close - r.nav) / r.nav) * 100,
  }));
}

function computeDynamicSellThresholds(cfg: SymbolConfig, history: PremiumPoint[]): number[] {
  const thresholds: number[] = [];
  for (let i = 0; i < history.length; i++) {
    const start = Math.max(0, i - cfg.roll_window + 1);
    const window = history.slice(start, i + 1).map((p) => p.premium_pct);
    if (window.length < 30) {
      thresholds.push(cfg.sell_floor);
      continue;
    }
    const sorted = [...window].sort((a, b) => a - b);
    const p95Idx = Math.floor((sorted.length - 1) * cfg.roll_pct);
    thresholds.push(Math.max(cfg.sell_floor, sorted[p95Idx]));
  }
  return thresholds;
}

function runStrategy(cfg: SymbolConfig, history: PremiumPoint[]) {
  let state: "in" | "out" = "out";
  const trades: Trade[] = [];
  let curBuy: Trade | null = null;
  const dynamicSell = computeDynamicSellThresholds(cfg, history);

  for (let i = 0; i < history.length; i++) {
    const p = history[i];
    const sellTh = dynamicSell[i];
    if (state === "out" && p.premium_pct < cfg.buy_th) {
      state = "in";
      curBuy = { date: p.date, action: "BUY", premium: p.premium_pct, close: p.close };
      trades.push(curBuy);
    } else if (state === "in" && p.premium_pct > sellTh) {
      state = "out";
      const t: Trade = { date: p.date, action: "SELL", premium: p.premium_pct, close: p.close };
      if (curBuy) {
        const buyT = Date.parse(curBuy.date);
        const sellT = Date.parse(p.date);
        t.hold_days = Math.round((sellT - buyT) / 86400000);
        t.pnl_pct = ((p.close / curBuy.close) * Math.pow(1 - cfg.cost, 2) - 1) * 100;
      }
      trades.push(t);
      curBuy = null;
    }
  }
  return {
    state, trades, open_trade: curBuy,
    current_sell_threshold: dynamicSell[dynamicSell.length - 1],
  };
}

// ============================================================
// API handler
// ============================================================

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const symbolParam = url.searchParams.get("symbol");
  const cfg = getConfig(symbolParam);
  const debug = url.searchParams.get("debug") === "1";
  const debugLog: any[] = [];

  try {
    const baked = buildBakedHistory(cfg);
    const bakedEnd = baked[baked.length - 1].date;
    debugLog.push(`baked: ${baked.length} 行, 至 ${bakedEnd}`);

    const d1Delta = await readDeltaFromD1(env, cfg.symbol, bakedEnd);
    debugLog.push(`D1 增量 (> ${bakedEnd}): ${d1Delta.length} 行`);

    const lastKnown = d1Delta.length > 0 ? d1Delta[d1Delta.length - 1].date : bakedEnd;
    const newRows = await fetchNewRows(cfg, lastKnown);
    debugLog.push(`新拉到可入库的行: ${newRows.length}`);
    if (newRows.length > 0) {
      const written = await upsertD1Rows(env, cfg.symbol, newRows);
      debugLog.push(`写入 D1: ${written} 行`);
      const d1Refresh = await readDeltaFromD1(env, cfg.symbol, bakedEnd);
      d1Delta.length = 0;
      d1Delta.push(...d1Refresh);
    }

    let history = [...baked, ...d1Delta].filter((p) => Math.abs(p.premium_pct) <= 30);
    history.sort((a, b) => a.date.localeCompare(b.date));
    const seen = new Set<string>();
    history = history.filter((p) => {
      if (seen.has(p.date)) return false;
      seen.add(p.date);
      return true;
    });

    if (history.length === 0) throw new Error("No history rows");

    const [realtime, latestNav] = await Promise.all([
      fetchRealtimeFromTencent(cfg),
      fetchLatestNavViaFundgz(cfg),
    ]);

    // 实时溢价 — 两个口径分开算
    //
    // 主显示 (同花顺 / 行情软件版, 跟回测一致):
    //   premium = (实时价 - T-1 已公布 dwjz NAV) / dwjz × 100
    //   ⭐ 这个数字跟策略阈值 (3% 买 / 7% 卖) 直接可比
    //   ⭐ 实盘用这个判断是否触发
    //
    // 参考 (gsz 估算版, 反映美股 overnight + 实时汇率):
    //   premium = (实时价 - fundgz.gsz) / gsz × 100
    //   - 消除了 overnight NAV 变化的影响
    //   - 显示 ETF 相对于"真实价值"的偏离
    //   - 但 NOT 跟回测口径一致, 不能直接套阈值

    let nowPremium: number | null = null;            // 主显示: 行情软件版
    let nowPremiumGszEst: number | null = null;      // 参考: gsz 估算版
    let nowNav: number | null = null;                // 主: 用的 NAV (dwjz)
    let nowNavGsz: number | null = null;             // 参考: gsz NAV
    let nowClose: number | null = null;

    if (realtime && latestNav) {
      nowClose = realtime.price;
      // 主: 用 T-1 dwjz NAV (跟行情软件 / 回测一致)
      nowNav = latestNav.dwjz;
      nowPremium = ((nowClose - nowNav) / nowNav) * 100;
      // 参考: 用 gsz 估算 NAV
      if (latestNav.gsz) {
        nowNavGsz = latestNav.gsz;
        nowPremiumGszEst = ((nowClose - nowNavGsz) / nowNavGsz) * 100;
      }
    } else if (realtime) {
      // 没有 fundgz, 用 history 最新 NAV
      nowClose = realtime.price;
      nowNav = history[history.length - 1].nav;
      nowPremium = ((nowClose - nowNav) / nowNav) * 100;
    } else if (latestNav?.gsz && latestNav.dwjz) {
      // 没有实时价: 用 gsz 跟 dwjz 算 (相当于"今天估算的隐含 premium")
      nowPremium = ((latestNav.gsz - latestNav.dwjz) / latestNav.dwjz) * 100;
      nowNav = latestNav.dwjz;
      nowClose = latestNav.gsz;
    }

    const { state, trades, open_trade, current_sell_threshold } = runStrategy(cfg, history);
    const latest = history[history.length - 1];
    const SELL_TH = current_sell_threshold;

    let openInfo: any = null;
    if (state === "in" && open_trade) {
      const buyT = Date.parse(open_trade.date);
      const todayT = Date.parse(new Date().toISOString().slice(0, 10));
      const holdDays = Math.round((todayT - buyT) / 86400000);
      const refPrice = realtime?.price ?? latest.close;
      const floatingPnl = ((refPrice / open_trade.close) * (1 - cfg.cost) - 1) * 100;
      openInfo = {
        buy_date: open_trade.date,
        buy_close: open_trade.close,
        buy_premium: parseFloat(open_trade.premium.toFixed(3)),
        current_close: refPrice,
        current_premium: parseFloat((nowPremium ?? latest.premium_pct).toFixed(3)),
        hold_days: holdDays,
        floating_pnl_pct: parseFloat(floatingPnl.toFixed(2)),
      };
    }

    const roundTrips: any[] = [];
    let pending: Trade | null = null;
    for (const t of trades) {
      if (t.action === "BUY") pending = t;
      else if (t.action === "SELL" && pending) {
        roundTrips.push({
          buy_date: pending.date, buy_close: pending.close,
          buy_premium: parseFloat(pending.premium.toFixed(2)),
          sell_date: t.date, sell_close: t.close,
          sell_premium: parseFloat(t.premium.toFixed(2)),
          hold_days: t.hold_days,
          pnl_pct: parseFloat((t.pnl_pct ?? 0).toFixed(2)),
        });
        pending = null;
      }
    }

    // 用主 premium (跟阈值同口径) 算距离
    const curPrem = nowPremium ?? latest.premium_pct;
    const distSell = state === "in" ? SELL_TH - curPrem : null;
    const distBuy = state === "out" ? curPrem - cfg.buy_th : null;

    const chartHistory = history.slice(-120).map((p) => ({
      date: p.date,
      premium_pct: parseFloat(p.premium_pct.toFixed(3)),
      nav: p.nav, close: p.close,
    }));

    const recent60 = history.slice(-60).map((p) => p.premium_pct);
    const stats = {
      n_total: history.length,
      span: { start: history[0].date, end: latest.date },
      mean_60d: parseFloat((recent60.reduce((s, v) => s + v, 0) / recent60.length).toFixed(2)),
      max_60d: parseFloat(Math.max(...recent60).toFixed(2)),
      min_60d: parseFloat(Math.min(...recent60).toFixed(2)),
      n_above_sellfloor_60d: recent60.filter((v) => v > cfg.sell_floor).length,
      n_above_avg_60d: recent60.filter((v) => v > 0).length,
      n_below_0_60d: recent60.filter((v) => v < 0).length,
    };

    const today = new Date().toISOString().slice(0, 10);
    let missingTradingDays = 0;
    {
      const start = new Date(latest.date);
      start.setUTCDate(start.getUTCDate() + 1);
      const endD = new Date(today);
      while (start <= endD) {
        const dow = start.getUTCDay();
        if (dow !== 0 && dow !== 6) missingTradingDays++;
        start.setUTCDate(start.getUTCDate() + 1);
      }
    }
    const todayDow = new Date(today).getUTCDay();
    const todayIsTradingDay = todayDow >= 1 && todayDow <= 5;
    const navLag = todayIsTradingDay && missingTradingDays >= 1 ? missingTradingDays - 1 : 0;
    const freshness = {
      latest_data_date: latest.date,
      today: today,
      today_is_trading_day: todayIsTradingDay,
      missing_trading_days: missingTradingDays,
      nav_lag_days: navLag,
      baseline_end: bakedEnd,
      d1_delta_rows: d1Delta.length,
      d1_delta_latest: d1Delta.length > 0 ? d1Delta[d1Delta.length-1].date : null,
      newly_fetched_today: newRows.length,
      fundgz_latest_jzrq: latestNav?.jzrq ?? null,
      warning: navLag >= 2
        ? `NAV 滞后 ${navLag} 个交易日未入库, 可能错过信号! 请检查 fundgz 是否正常`
        : null,
    };

    // 优先用 fundgz 返回的真实名字 (官方权威), fallback 到 config 硬编码
    const realName = latestNav?.real_name || cfg.name;

    return Response.json({
      symbol: cfg.symbol,
      name: realName,
      name_config: cfg.name,
      name_source: latestNav?.real_name ? "fundgz" : "config",
      index_name: cfg.index_name,
      available_symbols: listSymbols(),
      strategy: {
        version: "V5 自适应",
        buy_th: cfg.buy_th,
        sell_th: parseFloat(SELL_TH.toFixed(2)),
        sell_floor: cfg.sell_floor,
        sell_rule: `max(${cfg.sell_floor}, 过去 ${cfg.roll_window} 日 P${Math.round(cfg.roll_pct*100)})`,
        cost: cfg.cost,
      },
      now: {
        // 主显示 (跟行情软件 / 回测一致)
        premium_pct: nowPremium !== null ? parseFloat(nowPremium.toFixed(3)) : null,
        close: nowClose,
        nav: nowNav,
        nav_source: "T-1 已公布 NAV (dwjz)",
        close_source: realtime ? "Tencent 实时" : (latestNav ? "fundgz gsz" : null),
        formula: "(实时价 − T-1 dwjz NAV) / T-1 dwjz NAV × 100",
        fetched_at: new Date().toISOString(),
        // 参考: 用 gsz 估算 NAV (含美股 overnight + 实时汇率)
        gsz_estimate: nowPremiumGszEst !== null ? {
          premium_pct: parseFloat(nowPremiumGszEst.toFixed(3)),
          nav_gsz: nowNavGsz,
          note: "gsz 估算了今日 NAV 变化, 通常比主 premium 略低 (含美股已发生的涨跌) — 仅供参考, 不用于策略触发",
        } : null,
      },
      latest_eod: {
        date: latest.date, nav: latest.nav, close: latest.close,
        premium_pct: parseFloat(latest.premium_pct.toFixed(3)),
      },
      latest_nav_source: latestNav ? {
        date: latestNav.jzrq, nav: latestNav.dwjz,
        gsz: latestNav.gsz, gszzl: latestNav.gszzl, gztime: latestNav.gztime,
      } : null,
      realtime: realtime ? {
        price: realtime.price, pct_change: realtime.pct_change,
        prev_close: realtime.prev_close,
      } : null,
      signal: {
        current_state: state,
        next_action: state === "in"
          ? `持仓中, 等溢价率涨到 ${SELL_TH.toFixed(2)}% 以上自动卖出`
          : `空仓中, 等溢价率跌到 ${cfg.buy_th.toFixed(2)}% 以下自动买入`,
        distance_to_sell_pp: distSell !== null ? parseFloat(distSell.toFixed(2)) : null,
        distance_to_buy_pp: distBuy !== null ? parseFloat(distBuy.toFixed(2)) : null,
        last_trade: trades.length > 0 ? {
          date: trades[trades.length - 1].date,
          action: trades[trades.length - 1].action,
          premium: parseFloat(trades[trades.length - 1].premium.toFixed(2)),
          close: trades[trades.length - 1].close,
        } : null,
      },
      open_position: openInfo,
      round_trips: roundTrips,
      stats_recent_60d: stats,
      data_freshness: freshness,
      history: chartHistory,
      generated_at: new Date().toISOString(),
      ...(debug ? { debug_log: debugLog } : {}),
    }, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message, stack: e.stack, debug_log: debugLog }, null, 2),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
