import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any


class RequestValidationError(Exception):
    def __init__(self, message: str, fields: dict[str, str] | None = None):
        super().__init__(message)
        self.message = message
        self.fields = fields or {}


BUSINESS_STRING_FIELDS = {"name", "industry", "location", "currency"}
BUSINESS_AMOUNT_FIELDS = {
    "monthly_revenue",
    "supplier_costs",
    "rent",
    "staff_salaries",
    "other_expenses",
    "cash_balance",
    "inventory_value",
    "liabilities",
}
REQUIRED_BUSINESS_FIELDS = {
    "name",
    "industry",
    "location",
    "monthly_revenue",
    "supplier_costs",
    "rent",
    "staff_salaries",
    "other_expenses",
    "cash_balance",
}
BUSINESS_FIELDS = BUSINESS_STRING_FIELDS | BUSINESS_AMOUNT_FIELDS | {"custom_monthly_variables"}
SCENARIO_EVENT_TYPES = {
    "supplier_price_increase",
    "sales_decrease",
    "expense_change",
    "major_customer_loss",
    "new_competitor",
    "interest_rate_increase",
    "new_branch",
    "custom",
}
SCENARIO_FIELDS = {"title", "event_type", "description", "assumptions", "missing_information"}


def _parse_amount(value: Any, field: str, *, nullable: bool = False) -> Decimal | None:
    if value is None and nullable:
        return None
    if isinstance(value, bool):
        raise RequestValidationError("Amount must be a number.", {field: "Enter a non-negative amount."})
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise RequestValidationError("Amount must be a number.", {field: "Enter a valid amount."}) from None
    if not amount.is_finite() or amount < 0:
        raise RequestValidationError("Amount must be a non-negative number.", {field: "Enter a non-negative amount."})
    if amount.as_tuple().exponent < -2 or amount >= Decimal("1000000000000"):
        raise RequestValidationError("Amount is outside the supported range.", {field: "Use at most two decimal places and fewer than 1 trillion."})
    return amount


def parse_business_payload(data: Any, *, partial: bool = False) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise RequestValidationError("Request body must be a JSON object.")
    if partial and not data:
        raise RequestValidationError("At least one business field is required.")
    unknown = set(data) - BUSINESS_FIELDS
    if unknown:
        raise RequestValidationError("Request contains unsupported fields.", {field: "Unknown field." for field in sorted(unknown)})
    missing = REQUIRED_BUSINESS_FIELDS - set(data) if not partial else set()
    if missing:
        raise RequestValidationError("Required business information is missing.", {field: "This field is required." for field in sorted(missing)})

    result: dict[str, Any] = {}
    for field in BUSINESS_STRING_FIELDS & set(data):
        value = data[field]
        if not isinstance(value, str) or not value.strip():
            raise RequestValidationError("Text fields cannot be empty.", {field: "Enter a value."})
        value = value.strip()
        max_length = 3 if field == "currency" else 160 if field == "location" else 120 if field == "industry" else 160
        if len(value) > max_length:
            raise RequestValidationError("Text field is too long.", {field: f"Use {max_length} characters or fewer."})
        if field == "currency":
            if not re.fullmatch(r"[A-Za-z]{3}", value):
                raise RequestValidationError("Currency must be a three-letter code.", {field: "Use an ISO-style code such as MYR."})
            value = value.upper()
        result[field] = value

    for field in BUSINESS_AMOUNT_FIELDS & set(data):
        result[field] = _parse_amount(data[field], field, nullable=field in {"inventory_value", "liabilities"})
    if "custom_monthly_variables" in data:
        variables = data["custom_monthly_variables"]
        if not isinstance(variables, list):
            raise RequestValidationError("Custom monthly variables must be a list.")
        normalized = []
        names = set()
        for item in variables:
            if not isinstance(item, dict) or set(item) != {"name", "value"}:
                raise RequestValidationError("Each custom variable needs a name and amount.")
            name = item["name"]
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
                raise RequestValidationError("Variable names must contain 1 to 80 characters.")
            if name.strip().casefold() in names:
                raise RequestValidationError("Custom variable names must be unique.")
            names.add(name.strip().casefold())
            normalized.append({"name": name.strip(), "value": format(_parse_amount(item["value"], "custom_monthly_variables"), ".2f")})
        result["custom_monthly_variables"] = normalized
    if not partial:
        result.setdefault("currency", "MYR")
    return result


def _validate_json_value(value: Any, field: str) -> None:
    try:
        json.dumps(value, allow_nan=False)
    except (TypeError, ValueError):
        raise RequestValidationError("Scenario assumptions must be valid JSON values.", {field: "Use JSON-compatible values."}) from None


def parse_scenario_payload(data: Any, *, partial: bool = False) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise RequestValidationError("Request body must be a JSON object.")
    unknown = set(data) - SCENARIO_FIELDS
    if unknown:
        raise RequestValidationError("Request contains unsupported fields.", {field: "Unknown field." for field in sorted(unknown)})

    if partial and not data:
        raise RequestValidationError("At least one editable field is required.")

    result: dict[str, Any] = {}
    if "title" in data or not partial:
        title = data.get("title")
        if not isinstance(title, str) or not title.strip():
            raise RequestValidationError("Scenario title is required.", {"title": "Enter a title."})
        if len(title.strip()) > 200:
            raise RequestValidationError("Scenario title is too long.", {"title": "Use 200 characters or fewer."})
        result["title"] = title.strip()

    if "event_type" in data or not partial:
        event_type = data.get("event_type")
        if not isinstance(event_type, str) or event_type not in SCENARIO_EVENT_TYPES:
            raise RequestValidationError("Scenario event type is not supported.", {"event_type": "Choose a supported event type."})
        result["event_type"] = event_type

    if "description" in data:
        description = data["description"]
        if description is not None and not isinstance(description, str):
            raise RequestValidationError("Description must be text or null.", {"description": "Enter text or null."})
        if isinstance(description, str) and len(description) > 4000:
            raise RequestValidationError("Description is too long.", {"description": "Use 4,000 characters or fewer."})
        result["description"] = description.strip() if isinstance(description, str) else None
    elif not partial:
        result["description"] = None

    if "assumptions" in data or not partial:
        assumptions = data.get("assumptions", {})
        if not isinstance(assumptions, dict):
            raise RequestValidationError("Assumptions must be a JSON object.", {"assumptions": "Use an object of named values."})
        _validate_json_value(assumptions, "assumptions")
        result["assumptions"] = assumptions

    if "missing_information" in data or not partial:
        missing_information = data.get("missing_information", [])
        if not isinstance(missing_information, list) or any(not isinstance(item, str) or not item.strip() for item in missing_information):
            raise RequestValidationError("Missing-information items must be non-empty text.", {"missing_information": "Use a list of questions or missing fields."})
        if len(missing_information) > 50:
            raise RequestValidationError("Too many missing-information items.", {"missing_information": "Use 50 items or fewer."})
        result["missing_information"] = [item.strip() for item in missing_information]
    return result
