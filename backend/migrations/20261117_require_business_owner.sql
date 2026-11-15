-- Before running this migration, assign every legacy business to its actual
-- owner. Example (replace the username with the intended account):
-- UPDATE businesses SET owner_id = (SELECT id FROM users WHERE username = 'owner') WHERE owner_id IS NULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM businesses WHERE owner_id IS NULL) THEN
        RAISE EXCEPTION 'Unowned businesses remain; explicitly backfill owner_id before enforcing ownership.';
    END IF;
END $$;

ALTER TABLE businesses ALTER COLUMN owner_id SET NOT NULL;
