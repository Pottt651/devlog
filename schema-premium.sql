-- Premium arb daily history (delta only — baseline 全 968 天 baked in worker bundle)
CREATE TABLE IF NOT EXISTS premium_history (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  nav REAL NOT NULL,
  close REAL NOT NULL,
  premium_pct REAL NOT NULL,
  source TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_premium_history_symbol_date
  ON premium_history(symbol, date);
