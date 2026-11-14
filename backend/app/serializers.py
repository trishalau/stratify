from decimal import Decimal
from typing import Any

from .models import Business, Scenario


def _amount(value: Decimal | None) -> str | None:
    return format(value, ".2f") if value is not None else None


def business_to_dict(business: Business) -> dict[str, Any]:
    return {
        "id": business.id,
        "name": business.name,
        "industry": business.industry,
        "location": business.location,
        "currency": business.currency,
        "monthly_revenue": _amount(business.monthly_revenue),
        "supplier_costs": _amount(business.supplier_costs),
        "rent": _amount(business.rent),
        "staff_salaries": _amount(business.staff_salaries),
        "other_expenses": _amount(business.other_expenses),
        "cash_balance": _amount(business.cash_balance),
        "inventory_value": _amount(business.inventory_value),
        "liabilities": _amount(business.liabilities),
        "created_at": business.created_at.isoformat(),
        "updated_at": business.updated_at.isoformat(),
    }


def scenario_to_dict(scenario: Scenario) -> dict[str, Any]:
    return {
        "id": scenario.id,
        "business_id": scenario.business_id,
        "title": scenario.title,
        "event_type": scenario.event_type,
        "description": scenario.description,
        "assumptions": scenario.assumptions,
        "missing_information": scenario.missing_information,
        "status": scenario.status,
        "confirmed_at": scenario.confirmed_at.isoformat() if scenario.confirmed_at else None,
        "created_at": scenario.created_at.isoformat(),
        "updated_at": scenario.updated_at.isoformat(),
    }
