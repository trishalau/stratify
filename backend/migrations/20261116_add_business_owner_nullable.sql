-- Preserve every existing business row. The owner is backfilled explicitly
-- in 20261117_require_business_owner.sql before NOT NULL is enforced.
ALTER TABLE businesses
    ADD COLUMN owner_id INTEGER NULL REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX ix_businesses_owner_id ON businesses(owner_id);
