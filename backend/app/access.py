"""Shared business ownership rules for demo and authenticated modes."""

from flask import current_app, g
from sqlalchemy import select

from .models import Business

DEMO_BUSINESS_NAME = "KL Electronics Sdn. Bhd."

# The prototype database predates owner registration and has no owner_id column.
# Keep this explicit projection separate from the full production ORM mapping.
DEMO_BUSINESS_COLUMNS = (
    Business.id,
    Business.name,
    Business.industry,
    Business.location,
    Business.currency,
    Business.monthly_revenue,
    Business.supplier_costs,
    Business.rent,
    Business.staff_salaries,
    Business.other_expenses,
    Business.cash_balance,
    Business.inventory_value,
    Business.liabilities,
    Business.custom_monthly_variables,
    Business.created_at,
    Business.updated_at,
)


def accessible_businesses_query():
    if current_app.config.get("STRATIFY_DEMO_MODE"):
        return select(*DEMO_BUSINESS_COLUMNS).where(Business.name == DEMO_BUSINESS_NAME)
    return select(Business).where(Business.owner_id == g.current_user.id)


def find_accessible_business(business_id: int):
    query = accessible_businesses_query().where(Business.id == business_id)
    if current_app.config.get("STRATIFY_DEMO_MODE"):
        return g.db_session.execute(query).mappings().one_or_none()
    return g.db_session.scalar(query)
