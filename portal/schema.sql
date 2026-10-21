CREATE TABLE IF NOT EXISTS portal_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  device TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_sessions_expiry ON portal_sessions(expires_at);
CREATE TABLE IF NOT EXISTS portal_login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_otp_challenges (
  id_hash TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  remember INTEGER NOT NULL DEFAULT 1,
  next TEXT NOT NULL DEFAULT '/'
);
CREATE TABLE IF NOT EXISTS portal_otp_limits (
  email TEXT PRIMARY KEY,
  last_sent INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
