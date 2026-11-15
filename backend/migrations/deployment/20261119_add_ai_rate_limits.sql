-- Add database-backed rate limiting for the public Gemini interpretation route.
-- Run once on the separate managed demo database after the demo schema migration.
BEGIN;

DO $$
BEGIN
    IF current_database() = 'stratify' THEN
        RAISE EXCEPTION 'Refusing deployment migration on the local Stratify database.';
    END IF;
    IF to_regclass('public.stratify_schema_migrations') IS NULL THEN
        RAISE EXCEPTION 'Run 20261118_create_public_demo.sql before this migration.';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_rate_limits (
    client_hash VARCHAR(64) PRIMARY KEY,
    window_started TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0
        CONSTRAINT ck_ai_rate_limit_count_nonnegative CHECK (request_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_ai_rate_limits_updated_at ON ai_rate_limits(updated_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'ai_rate_limits'
          AND column_name = 'client_hash'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'ai_rate_limits'
          AND column_name = 'window_started'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'ai_rate_limits'
          AND column_name = 'request_count'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'ai_rate_limits'
          AND column_name = 'updated_at'
    ) THEN
        RAISE EXCEPTION 'AI rate limit table is missing required columns.';
    END IF;
END $$;

INSERT INTO stratify_schema_migrations (version)
VALUES ('20261119_add_ai_rate_limits')
ON CONFLICT (version) DO NOTHING;

COMMIT;
