ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS custom_monthly_variables JSON NOT NULL DEFAULT '[]'::json;
