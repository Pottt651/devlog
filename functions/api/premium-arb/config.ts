// 各 ETF 标的的策略配置 + 数据源
// 添加新标的: 复制一条, 改 symbol/name/thresholds, 跑导出脚本生成 history-XXX.ts

import { HISTORY as HISTORY_159612 } from "./history-159612";
import { HISTORY as HISTORY_159659 } from "./history-159659";
import type { HistoryRow } from "./history-159612";

export interface SymbolConfig {
  symbol: string;
  name: string;
  index_name: string;       // 中文指数名 (展示用)
  exchange_prefix: string;  // sz 或 sh (Tencent 接口用)
  // V5 策略参数
  buy_th: number;
  sell_floor: number;
  roll_window: number;
  roll_pct: number;
  cost: number;
  // 烘焙的历史
  history: HistoryRow[];
}

export const SYMBOLS: Record<string, SymbolConfig> = {
  "159612": {
    symbol: "159612",
    name: "国泰标普500ETF",
    index_name: "标普 500 (S&P 500)",
    exchange_prefix: "sz",
    buy_th: 3.0,
    sell_floor: 6.0,
    roll_window: 60,
    roll_pct: 0.95,
    cost: 0.001,
    history: HISTORY_159612,
  },
  "159659": {
    symbol: "159659",
    name: "纳斯达克100ETF招商",  // 招商基金管理 (我之前研究里误标为"华泰柏瑞", 已修正)
    index_name: "纳指 100 (NASDAQ-100)",
    exchange_prefix: "sz",
    buy_th: 0.5,
    sell_floor: 3.5,
    roll_window: 60,
    roll_pct: 0.95,
    cost: 0.001,
    history: HISTORY_159659,
  },
};

export const DEFAULT_SYMBOL = "159612";

export function getConfig(symbol?: string | null): SymbolConfig {
  if (symbol && SYMBOLS[symbol]) return SYMBOLS[symbol];
  return SYMBOLS[DEFAULT_SYMBOL];
}

export function listSymbols() {
  return Object.values(SYMBOLS).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    index_name: c.index_name,
    buy_th: c.buy_th,
    sell_floor: c.sell_floor,
  }));
}
