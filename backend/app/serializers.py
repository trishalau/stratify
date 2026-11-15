from decimal import Decimal
from collections.abc import Mapping
from typing import Any

from .models import Business, Scenario


def _amount(value: Decimal | None) -> str | None:
    return format(value, ".2f") if value is not None else None


def _business_value(business: Business | Mapping[str, Any], field: str) -> Any:
    if isinstance(business, Mapping):
        return business[field]
    return getattr(business, field)


def business_to_dict(business: Business | Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": _business_value(business, "id"),
        "name": _business_value(business, "name"),
        "industry": _business_value(business, "industry"),
        "location": _business_value(business, "location"),
        "currency": _business_value(business, "currency"),
        "monthly_revenue": _amount(_business_value(business, "monthly_revenue")),
        "supplier_costs": _amount(_business_value(business, "supplier_costs")),
        "rent": _amount(_business_value(business, "rent")),
        "staff_salaries": _amount(_business_value(business, "staff_salaries")),
        "other_expenses": _amount(_business_value(business, "other_expenses")),
        "cash_balance": _amount(_business_value(business, "cash_balance")),
        "inventory_value": _amount(_business_value(business, "inventory_value")),
        "liabilities": _amount(_business_value(business, "liabilities")),
        "custom_monthly_variables": _business_value(business, "custom_monthly_variables") or [],
        "created_at": _business_value(business, "created_at").isoformat(),
        "updated_at": _business_value(business, "updated_at").isoformat(),
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
