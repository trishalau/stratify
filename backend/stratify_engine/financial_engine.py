"""Deterministic monthly scenario calculations using decimal arithmetic."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Mapping

MONEY_QUANTUM = Decimal("0.01")
HUNDRED = Decimal("100")
EXPENSE_CATEGORIES = ("supplier_costs", "rent", "staff_salaries", "other_expenses")
MAX_AMOUNT = Decimal("1000000000000")

EVENT_FIELDS = {
    "supplier_price_increase": {
        "primary": "supplier_cost_increase_percent",
        "optimistic": "optimistic_supplier_cost_increase_percent",
        "pessimistic": "pessimistic_supplier_cost_increase_percent",
        "categories": ("supplier_costs",),
        "minimum": Decimal("0"),
        "maximum": Decimal("1000"),
    },
    "sales_decrease": {
        "primary": "sales_decrease_percent",
        "optimistic": "optimistic_sales_decrease_percent",
        "pessimistic": "pessimistic_sales_decrease_percent",
        "categories": (),
        "minimum": Decimal("0"),
        "maximum": Decimal("100"),
    },
    "expense_change": {
        "primary": "expense_change_percent",
        "optimistic": "optimistic_expense_change_percent",
        "pessimistic": "pessimistic_expense_change_percent",
        "categories": EXPENSE_CATEGORIES,
        "minimum": Decimal("-100"),
        "maximum": Decimal("1000"),
    },
}


class FinancialEngineError(ValueError):
    """An invalid profile or scenario input prevented a calculation."""

    def __init__(self, message: str, field: str = "assumptions"):
        super().__init__(message)
        self.field = field


class UnconfirmedScenarioError(FinancialEngineError):
    """Raised when a draft or incomplete scenario reaches the engine."""

    def __init__(self):
        super().__init__("Only scenarios with confirmed assumptions can be simulated.", "status")


def _decimal(value: Any, field: str) -> Decimal:
    if isinstance(value, bool):
        raise FinancialEngineError("Enter a numeric value.", field)
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise FinancialEngineError("Enter a valid numeric value.", field) from None
    if not result.is_finite():
        raise FinancialEngineError("The value must be finite.", field)
    return result


def _money(value: Any, field: str) -> Decimal:
    amount = _decimal(value, field)
    if amount < 0 or amount >= MAX_AMOUNT:
        raise FinancialEngineError("Enter a non-negative amount below 1 trillion.", field)
    return amount.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _percentage(value: Any, field: str, minimum: Decimal, maximum: Decimal) -> Decimal:
    percentage = _decimal(value, field)
    if percentage < minimum or percentage > maximum:
        raise FinancialEngineError(f"Use a percentage from {minimum} to {maximum}.", field)
    return percentage


def _profile_values(business: Mapping[str, Any]) -> dict[str, Any]:
    required = ("monthly_revenue", "cash_balance", *EXPENSE_CATEGORIES)
    values = {field: _money(business.get(field), field) for field in required}
    currency = business.get("currency", "MYR")
    if not isinstance(currency, str) or len(currency) != 3 or not currency.isascii() or not currency.isalpha():
        raise FinancialEngineError("Business currency must be a three-letter code.", "currency")
    values["currency"] = currency.upper()
    custom = business.get("custom_monthly_variables", [])
    if not isinstance(custom, list):
        raise FinancialEngineError("Custom monthly variables must be a list.", "custom_monthly_variables")
    values["custom_expenses"] = {}
    for item in custom:
        if not isinstance(item, Mapping) or not isinstance(item.get("name"), str):
            raise FinancialEngineError("A custom monthly variable is malformed.", "custom_monthly_variables")
        name = item["name"].strip()
        if not name or name in values["custom_expenses"]:
            raise FinancialEngineError("Custom monthly variable names must be unique.", "custom_monthly_variables")
        values["custom_expenses"][name] = _money(item.get("value"), "custom_monthly_variables")
    return values


def _format_money(value: Decimal) -> str:
    return format(value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP), ".2f")


def _position(revenue: Decimal, expenses: Mapping[str, Decimal], currency: str) -> dict[str, Any]:
    normalized_expenses = {
        category: value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
        for category, value in expenses.items()
    }
    total_expenses = sum(normalized_expenses.values(), Decimal("0.00"))
    normalized_revenue = revenue.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    profit = normalized_revenue - total_expenses
    if total_expenses >= MAX_AMOUNT or abs(profit) >= MAX_AMOUNT:
        raise FinancialEngineError("The combined financial position is outside the supported range.")
    return {
        "currency": currency,
        "monthly_revenue": _format_money(normalized_revenue),
        "expenses": {key: _format_money(value) for key, value in normalized_expenses.items()},
        "total_expenses": _format_money(total_expenses),
        "net_profit": _format_money(profit),
    }


def _calculate_case(
    profile: Mapping[str, Any],
    event_type: str,
    percentage: Decimal,
    expense_category: str | None,
) -> dict[str, Any]:
    revenue = profile["monthly_revenue"]
    expenses = {category: profile[category] for category in EXPENSE_CATEGORIES}
    expenses.update({f"custom:{name}": amount for name, amount in profile["custom_expenses"].items()})

    if event_type == "sales_decrease":
        revenue = revenue * (Decimal("1") - percentage / HUNDRED)
    elif event_type == "supplier_price_increase":
        expenses["supplier_costs"] *= Decimal("1") + percentage / HUNDRED
    elif event_type == "expense_change" and expense_category:
        expenses[expense_category] *= Decimal("1") + percentage / HUNDRED

    rounded_expenses = {
        category: amount.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
        for category, amount in expenses.items()
    }
    rounded_revenue = revenue.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    if rounded_revenue >= MAX_AMOUNT or any(amount >= MAX_AMOUNT for amount in rounded_expenses.values()):
        raise FinancialEngineError("The scenario produces an amount outside the supported range.")
    return _position(rounded_revenue, rounded_expenses, profile["currency"])


def simulate_scenario(business: Mapping[str, Any], scenario: Mapping[str, Any]) -> dict[str, Any]:
    """Return a monthly baseline and confirmed scenario estimates.

    Optimistic and pessimistic inputs are optional as a pair. The engine never
    manufactures a range when the user has not supplied both alternatives.
    Cash-flow projections remain unavailable because timing and financing data
    are not present in the phase 2 business profile.
    """
    if scenario.get("status") != "confirmed" or scenario.get("missing_information"):
        raise UnconfirmedScenarioError()

    event_type = scenario.get("event_type")
    if not isinstance(event_type, str) or event_type not in EVENT_FIELDS:
        raise FinancialEngineError("This event type does not have a calculation in this phase.", "event_type")

    assumptions = scenario.get("assumptions")
    if not isinstance(assumptions, Mapping):
        raise FinancialEngineError("Assumptions must be a structured object.", "assumptions")
    spec = EVENT_FIELDS[event_type]
    allowed_fields = {"expense_category", spec["primary"], spec["optimistic"], spec["pessimistic"]}
    unknown_fields = set(assumptions) - allowed_fields
    if unknown_fields:
        raise FinancialEngineError(f"Unsupported assumption field: {sorted(unknown_fields)[0]}.")
    if spec["primary"] not in assumptions:
        raise FinancialEngineError(f"{spec['primary']} is required.", spec["primary"])

    expense_category = None
    if event_type == "expense_change":
        expense_category = assumptions.get("expense_category")
        supported_categories = (*spec["categories"], *(f"custom:{name}" for name in _profile_values(business)["custom_expenses"]))
        if expense_category not in supported_categories:
            raise FinancialEngineError("Choose a supported monthly expense category.", "expense_category")

    primary = _percentage(
        assumptions[spec["primary"]], spec["primary"], spec["minimum"], spec["maximum"]
    )
    optimistic_present = spec["optimistic"] in assumptions
    pessimistic_present = spec["pessimistic"] in assumptions
    if optimistic_present != pessimistic_present:
        raise FinancialEngineError("Provide both optimistic and pessimistic assumptions, or neither.")

    profile = _profile_values(business)
    baseline_expenses = {category: profile[category] for category in EXPENSE_CATEGORIES}
    baseline_expenses.update({f"custom:{name}": value for name, value in profile["custom_expenses"].items()})
    baseline = _position(profile["monthly_revenue"], baseline_expenses, profile["currency"])
    central = _calculate_case(profile, event_type, primary, expense_category)
    optimistic = None
    pessimistic = None

    if optimistic_present and pessimistic_present:
        optimistic_percent = _percentage(
            assumptions[spec["optimistic"]], spec["optimistic"], spec["minimum"], spec["maximum"]
        )
        pessimistic_percent = _percentage(
            assumptions[spec["pessimistic"]], spec["pessimistic"], spec["minimum"], spec["maximum"]
        )
        optimistic = _calculate_case(profile, event_type, optimistic_percent, expense_category)
        pessimistic = _calculate_case(profile, event_type, pessimistic_percent, expense_category)
        if not (
            Decimal(optimistic["net_profit"]) >= Decimal(central["net_profit"])
            >= Decimal(pessimistic["net_profit"])
        ):
            raise FinancialEngineError(
                "Alternative assumptions must produce an optimistic profit at least as high as the central case and a pessimistic profit no higher than it."
            )

    range_available = optimistic is not None and pessimistic is not None
    return {
        "scenario_id": scenario.get("id"),
        "title": scenario.get("title"),
        "event_type": event_type,
        "status": "estimate",
        "currency": profile["currency"],
        "period": "monthly",
        "assumptions": dict(assumptions),
        "baseline": baseline,
        "estimate": central,
        "comparison": {
            "range_available": range_available,
            "range_reason": None if range_available else "Provide explicit optimistic and pessimistic assumptions to calculate a range.",
            "baseline": baseline,
            "optimistic": optimistic,
            "central": central,
            "pessimistic": pessimistic,
        },
        "cash_flow": {
            "available": False,
            "current_cash_balance": _format_money(profile["cash_balance"]),
            "estimated_change": None,
            "estimated_closing_balance": None,
            "reason": "Cash balance is known, but collection and payment timing, debt service, taxes, and capital spending are not provided.",
        },
        "limitations": [
            "Profit is revenue less the expense categories provided; taxes, debt costs, depreciation, and one-time items are not included.",
            "Cash-flow impact is not calculated because timing and financing information is missing.",
            "This is a hypothetical estimate based on confirmed inputs, not a guaranteed prediction or financial advice.",
        ],
    }
