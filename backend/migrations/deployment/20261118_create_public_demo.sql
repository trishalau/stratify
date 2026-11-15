-- One-time initialization for a NEW, separate managed PostgreSQL database.
-- This is intentionally a no-login schema: it creates no users table and no
-- businesses.owner_id column. Never run this against the local development DB.
BEGIN;

DO $$
BEGIN
    IF current_database() = 'stratify' THEN
        RAISE EXCEPTION 'Refusing deployment migration on the local Stratify database; use a separate managed database with a different database name.';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS stratify_schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS businesses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    industry VARCHAR(120) NOT NULL,
    location VARCHAR(160) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MYR',
    monthly_revenue NUMERIC(14, 2) NOT NULL,
    supplier_costs NUMERIC(14, 2) NOT NULL,
    rent NUMERIC(14, 2) NOT NULL,
    staff_salaries NUMERIC(14, 2) NOT NULL,
    other_expenses NUMERIC(14, 2) NOT NULL,
    cash_balance NUMERIC(14, 2) NOT NULL,
    inventory_value NUMERIC(14, 2),
    liabilities NUMERIC(14, 2),
    custom_monthly_variables JSON NOT NULL DEFAULT '[]'::json,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_business_revenue_nonnegative CHECK (monthly_revenue >= 0),
    CONSTRAINT ck_business_supplier_nonnegative CHECK (supplier_costs >= 0),
    CONSTRAINT ck_business_rent_nonnegative CHECK (rent >= 0),
    CONSTRAINT ck_business_salaries_nonnegative CHECK (staff_salaries >= 0),
    CONSTRAINT ck_business_other_expenses_nonnegative CHECK (other_expenses >= 0),
    CONSTRAINT ck_business_cash_nonnegative CHECK (cash_balance >= 0),
    CONSTRAINT ck_business_inventory_nonnegative CHECK (inventory_value IS NULL OR inventory_value >= 0),
    CONSTRAINT ck_business_liabilities_nonnegative CHECK (liabilities IS NULL OR liabilities >= 0),
    CONSTRAINT ck_business_custom_variables_array
        CHECK (json_typeof(custom_monthly_variables) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_name ON businesses(name);

CREATE TABLE IF NOT EXISTS scenarios (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    description TEXT,
    assumptions JSON NOT NULL DEFAULT '{}'::json,
    missing_information JSON NOT NULL DEFAULT '[]'::json,
    status VARCHAR(16) NOT NULL DEFAULT 'draft'
        CONSTRAINT ck_scenario_status_valid CHECK (status IN ('draft', 'confirmed')),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_scenarios_business_id ON scenarios(business_id);

INSERT INTO businesses (
    name, industry, location, currency, monthly_revenue, supplier_costs,
    rent, staff_salaries, other_expenses, cash_balance,
    inventory_value, liabilities, custom_monthly_variables
)
VALUES (
    'KL Electronics Sdn. Bhd.',
    'Consumer electronics retail',
    'Kuala Lumpur, Malaysia',
    'MYR',
    120000.00,
    40000.00,
    10000.00,
    20000.00,
    12000.00,
    160000.00,
    NULL,
    NULL,
    '[]'::json
)
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
    missing_columns TEXT[];
    missing_scenario_columns TEXT[];
    missing_constraints TEXT[];
    missing_indexes TEXT[];
BEGIN
    SELECT array_agg(required.column_name)
    INTO missing_columns
    FROM (VALUES
        ('id'), ('name'), ('industry'), ('location'), ('currency'),
        ('monthly_revenue'), ('supplier_costs'), ('rent'), ('staff_salaries'),
        ('other_expenses'), ('cash_balance'), ('inventory_value'), ('liabilities'),
        ('custom_monthly_variables'), ('created_at'), ('updated_at')
    ) AS required(column_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'businesses'
          AND column_name = required.column_name
    );
    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Demo businesses schema is missing columns: %', missing_columns;
    END IF;

    SELECT array_agg(required.column_name)
    INTO missing_scenario_columns
    FROM (VALUES
        ('id'), ('business_id'), ('title'), ('event_type'), ('description'),
        ('assumptions'), ('missing_information'), ('status'), ('confirmed_at'),
        ('created_at'), ('updated_at')
    ) AS required(column_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'scenarios'
          AND column_name = required.column_name
    );
    IF missing_scenario_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Demo scenarios schema is missing columns: %', missing_scenario_columns;
    END IF;

    SELECT array_agg(required.constraint_name)
    INTO missing_constraints
    FROM (VALUES
        ('businesses', 'ck_business_revenue_nonnegative'),
        ('businesses', 'ck_business_supplier_nonnegative'),
        ('businesses', 'ck_business_rent_nonnegative'),
        ('businesses', 'ck_business_salaries_nonnegative'),
        ('businesses', 'ck_business_other_expenses_nonnegative'),
        ('businesses', 'ck_business_cash_nonnegative'),
        ('businesses', 'ck_business_inventory_nonnegative'),
        ('businesses', 'ck_business_liabilities_nonnegative'),
        ('businesses', 'ck_business_custom_variables_array'),
        ('scenarios', 'ck_scenario_status_valid'),
        ('scenarios', 'scenarios_business_id_fkey')
    ) AS required(table_name, constraint_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = to_regclass(required.table_name)
          AND conname = required.constraint_name
    );
    IF missing_constraints IS NOT NULL THEN
        RAISE EXCEPTION 'Demo scenarios schema is missing constraints: %', missing_constraints;
    END IF;

    SELECT array_agg(required.index_name)
    INTO missing_indexes
    FROM (VALUES
        ('uq_businesses_name'),
        ('ix_scenarios_business_id')
    ) AS required(index_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = required.index_name
    );
    IF missing_indexes IS NOT NULL THEN
        RAISE EXCEPTION 'Demo schema is missing indexes: %', missing_indexes;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM businesses
        WHERE name = 'KL Electronics Sdn. Bhd.'
          AND currency = 'MYR'
          AND monthly_revenue = 120000.00
          AND supplier_costs = 40000.00
          AND rent = 10000.00
          AND staff_salaries = 20000.00
          AND other_expenses = 12000.00
          AND cash_balance = 160000.00
    ) THEN
        RAISE EXCEPTION 'KL Electronics demo seed is missing or has unexpected sample values.';
    END IF;
END $$;

INSERT INTO stratify_schema_migrations (version)
VALUES ('20261118_create_public_demo')
ON CONFLICT (version) DO NOTHING;

COMMIT;
