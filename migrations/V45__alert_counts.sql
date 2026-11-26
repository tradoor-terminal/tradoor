-- Telegram alert messages sent, a row per UTC day, for the status page.
CREATE TABLE telegram_sent (
  day  BIGINT PRIMARY KEY,
  sent BIGINT NOT NULL
);

-- The active alerts, read every ten seconds by the server's watcher.
CREATE INDEX alert_active_idx ON alert (id) WHERE active;
