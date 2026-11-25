-- An announcement may be a banner in the middle of the screen with a picture,
-- a new feature shown off, rather than a strip atop the app; and may end by
-- itself, a week or a month on, rather than when it is taken down.
ALTER TABLE announcement ADD COLUMN place TEXT NOT NULL DEFAULT 'bar';
ALTER TABLE announcement ADD COLUMN image TEXT;
ALTER TABLE announcement ADD COLUMN ends_at BIGINT;
