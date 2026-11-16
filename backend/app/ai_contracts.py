"""Contracts and validation for model output; never used for calculations."""

import re
from difflib import SequenceMatcher
from decimal import Decimal, InvalidOperation
from typing import Any

from .validation import SCENARIO_EVENT_TYPES

ASSUMPTION_NAMES = {
    "supplier_cost_increase_percent",
    "optimistic_supplier_cost_increase_percent",
    "pessimistic_supplier_cost_increase_percent",
    "sales_decrease_percent",
    "optimistic_sales_decrease_percent",
    "pessimistic_sales_decrease_percent",
    "expense_category",
    "expense_change_percent",
    "optimistic_expense_change_percent",
    "pessimistic_expense_change_percent",
    "customer_revenue_share_percent",
    "customer_monthly_revenue",
    "competitor_sales_decrease_percent",
    "interest_rate_increase_percentage_points",
    "outstanding_loan_balance",
    "new_branch_monthly_cost",
    "new_branch_setup_cost",
}

VARIABLE_NAMES = {
    "monthly_revenue",
    "supplier_costs",
    "rent",
    "staff_salaries",
    "other_expenses",
    "cash_balance",
    "inventory_value",
    "liabilities",
    "interest_costs",
    "customer_revenue",
    "competitor_sales",
    "branch_costs",
}

EVENT_ASSUMPTIONS = {
    "supplier_price_increase": {
        "supplier_cost_increase_percent",
        "optimistic_supplier_cost_increase_percent",
        "pessimistic_supplier_cost_increase_percent",
    },
    "sales_decrease": {
        "sales_decrease_percent",
        "optimistic_sales_decrease_percent",
        "pessimistic_sales_decrease_percent",
    },
    "expense_change": {
        "expense_category",
        "expense_change_percent",
        "optimistic_expense_change_percent",
        "pessimistic_expense_change_percent",
    },
    "major_customer_loss": {"customer_revenue_share_percent", "customer_monthly_revenue"},
    "new_competitor": {"competitor_sales_decrease_percent"},
    "interest_rate_increase": {"interest_rate_increase_percentage_points", "outstanding_loan_balance"},
    "new_branch": {"new_branch_monthly_cost", "new_branch_setup_cost"},
    "custom": ASSUMPTION_NAMES,
}

ASSUMPTION_UNITS = {
    "supplier_cost_increase_percent": "percent",
    "optimistic_supplier_cost_increase_percent": "percent",
    "pessimistic_supplier_cost_increase_percent": "percent",
    "sales_decrease_percent": "percent",
    "optimistic_sales_decrease_percent": "percent",
    "pessimistic_sales_decrease_percent": "percent",
    "expense_category": "category",
    "expense_change_percent": "percent",
    "optimistic_expense_change_percent": "percent",
    "pessimistic_expense_change_percent": "percent",
    "customer_revenue_share_percent": "percent",
    "customer_monthly_revenue": "MYR",
    "competitor_sales_decrease_percent": "percent",
    "interest_rate_increase_percentage_points": "percentage_points",
    "outstanding_loan_balance": "MYR",
    "new_branch_monthly_cost": "MYR",
    "new_branch_setup_cost": "MYR",
}

ASSUMPTION_BOUNDS = {
    "supplier_cost_increase_percent": (Decimal("0"), Decimal("1000")),
    "optimistic_supplier_cost_increase_percent": (Decimal("0"), Decimal("1000")),
    "pessimistic_supplier_cost_increase_percent": (Decimal("0"), Decimal("1000")),
    "sales_decrease_percent": (Decimal("0"), Decimal("100")),
    "optimistic_sales_decrease_percent": (Decimal("0"), Decimal("100")),
    "pessimistic_sales_decrease_percent": (Decimal("0"), Decimal("100")),
    "expense_change_percent": (Decimal("-100"), Decimal("1000")),
    "optimistic_expense_change_percent": (Decimal("-100"), Decimal("1000")),
    "pessimistic_expense_change_percent": (Decimal("-100"), Decimal("1000")),
    "customer_revenue_share_percent": (Decimal("0"), Decimal("100")),
    "customer_monthly_revenue": (Decimal("0"), Decimal("1000000000000")),
    "competitor_sales_decrease_percent": (Decimal("0"), Decimal("100")),
    "interest_rate_increase_percentage_points": (Decimal("0"), Decimal("100")),
    "outstanding_loan_balance": (Decimal("0"), Decimal("1000000000000")),
    "new_branch_monthly_cost": (Decimal("0"), Decimal("1000000000000")),
    "new_branch_setup_cost": (Decimal("0"), Decimal("1000000000000")),
}

EXPENSE_CATEGORY_ALIASES = {
    "supplier_costs": {"supplier cost", "supplier costs", "supplier expense", "supplier expenses", "cost of goods", "cost of goods sold", "purchases"},
    "rent": {"rent", "lease", "leasing"},
    "staff_salaries": {"staff salary", "staff salaries", "salary", "salaries", "wage", "wages", "payroll"},
    "other_expenses": {"other expense", "other expenses", "miscellaneous expense", "miscellaneous expenses"},
}

EXPENSE_CATEGORY_LABELS = {
    "supplier_costs": "Supplier costs",
    "rent": "Rent",
    "staff_salaries": "Staff salaries",
    "other_expenses": "Other expenses",
}

INTERPRETATION_SCHEMA = {
    "type": "object",
    "properties": {
        "event_type": {"type": "string", "enum": sorted(SCENARIO_EVENT_TYPES)},
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "affected_variables": {"type": "array", "items": {"type": "string", "enum": sorted(VARIABLE_NAMES)}},
        "assumptions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "enum": sorted(ASSUMPTION_NAMES)},
                    "value": {"anyOf": [{"type": "number"}, {"type": "string"}, {"type": "null"}]},
                    "unit": {"type": "string", "enum": ["percent", "percentage_points", "MYR", "category"]},
                    "evidence": {"type": "string"},
                },
                "required": ["name", "value", "unit", "evidence"],
                "additionalProperties": False,
            },
        },
        "missing_information": {"type": "array", "items": {"type": "string"}},
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["event_type", "title", "summary", "affected_variables", "assumptions", "missing_information", "follow_up_questions"],
    "additionalProperties": False,
}

EXPLANATION_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "drivers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "metric": {"type": "string", "enum": ["revenue", "expenses", "profit", "cash_flow"]},
                    "direction": {"type": "string", "enum": ["positive", "negative", "mixed", "unchanged", "unavailable"]},
                    "explanation": {"type": "string"},
                },
                "required": ["metric", "direction", "explanation"],
                "additionalProperties": False,
            },
        },
        "limitations": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "drivers", "limitations"],
    "additionalProperties": False,
}

NUMBER_PATTERN = re.compile(r"(?<![\w.])(?:RM\s*)?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?![\w.])", re.IGNORECASE)
DECREASE_PATTERN = re.compile(r"\b(decrease|decreases|decreased|reduce|reduces|reduced|lower|lowers|lowered|drop|drops|dropped|less|fall|falls|fell|decline|declines|declined|cut|cuts|cutting)\b|\bgo\s+down\b", re.IGNORECASE)
EXPENSE_CATEGORIES = {"supplier_costs", "rent", "staff_salaries", "other_expenses"}


def _expense_category_in_text(text: str) -> str | None:
    normalized = re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()
    for category, aliases in EXPENSE_CATEGORY_ALIASES.items():
        for alias in aliases:
            if re.search(rf"\b{re.escape(alias)}\b", normalized):
                return category
    return None


def _suggest_expense_category(value: str, quote: str) -> dict[str, str] | None:
    """Offer a close spelling as a question; never treat it as a confirmed mapping."""
    candidates = set()
    # Only suggest text actually written by the user. The model's proposed
    # category may already be normalized, and must not be presented as a quote.
    words = re.findall(r"[a-z]+", quote.casefold())
    for start in range(len(words)):
        for size in range(1, min(4, len(words) - start) + 1):
            phrase = " ".join(words[start:start + size])
            if len(phrase) >= 5:
                candidates.add(phrase)

    best_by_category: dict[str, tuple[float, str]] = {}
    for category, aliases in EXPENSE_CATEGORY_ALIASES.items():
        for candidate in candidates:
            score = max(SequenceMatcher(None, candidate, alias).ratio() for alias in aliases)
            if score > best_by_category.get(category, (0, ""))[0]:
                best_by_category[category] = (score, candidate)

    ranked = sorted(best_by_category.items(), key=lambda item: item[1][0], reverse=True)
    if not ranked or ranked[0][1][0] < 0.78:
        return None
    if len(ranked) > 1 and ranked[0][1][0] - ranked[1][1][0] < 0.07:
        return None
    category, (_, mentioned) = ranked[0]
    return {"category": category, "label": EXPENSE_CATEGORY_LABELS[category], "mentioned": mentioned}


class AIOutputValidationError(ValueError):
    """Model output did not satisfy application-level business rules."""


def _strings(value: Any, field: str, *, limit: int = 8, max_length: int = 400) -> list[str]:
    if not isinstance(value, list) or len(value) > limit:
        raise AIOutputValidationError(f"{field} must be a short list of text values.")
    result = []
    for item in value:
        if not isinstance(item, str) or not item.strip() or len(item.strip()) > max_length:
            raise AIOutputValidationError(f"{field} contains an invalid text value.")
        result.append(item.strip())
    return result


def _numeric_tokens(text: str) -> list[Decimal]:
    values = []
    for token in NUMBER_PATTERN.findall(text):
        try:
            values.append(Decimal(token.replace(",", "")))
        except InvalidOperation:
            continue
    return values


def _verify_text_numbers(text: str, source: str) -> None:
    source_numbers = _numeric_tokens(source)
    for value in _numeric_tokens(text):
        if value not in source_numbers:
            raise AIOutputValidationError("Model text introduced a number that the user did not provide.")


def _required_assumptions(event_type: str) -> tuple[set[str], list[str]]:
    if event_type == "supplier_price_increase":
        return {"supplier_cost_increase_percent"}, ["What percentage increase should be used for supplier costs? Please provide an explicit number."]
    if event_type == "sales_decrease":
        return {"sales_decrease_percent"}, ["What percentage decrease in monthly sales should be used? Please provide an explicit number."]
    if event_type == "expense_change":
        return {"expense_category", "expense_change_percent"}, ["Which monthly expense category changes, and by what percentage? Please provide both."]
    if event_type == "major_customer_loss":
        return {"customer_revenue_share_percent", "customer_monthly_revenue"}, ["What share or monthly amount of revenue does this customer represent?"]
    if event_type == "new_competitor":
        return {"competitor_sales_decrease_percent"}, ["What sales decrease should be explored for the competitor scenario?"]
    if event_type == "interest_rate_increase":
        return {"interest_rate_increase_percentage_points", "outstanding_loan_balance"}, ["What rate increase and outstanding loan balance should be used?"]
    if event_type == "new_branch":
        return {"new_branch_monthly_cost", "new_branch_setup_cost"}, ["What monthly operating cost and one-time setup cost should be used?"]
    return set(), ["What business change and measurable assumption would you like to explore?"]


def validate_interpretation(raw: Any, user_text: str, custom_expense_names: list[str] | None = None) -> dict[str, Any]:
    required_keys = {"event_type", "title", "summary", "affected_variables", "assumptions", "missing_information", "follow_up_questions"}
    if not isinstance(raw, dict) or set(raw) != required_keys:
        raise AIOutputValidationError("The model returned an invalid interpretation structure.")

    event_type = raw["event_type"]
    if not isinstance(event_type, str) or event_type not in SCENARIO_EVENT_TYPES:
        raise AIOutputValidationError("The model returned an unsupported event type.")
    event_fields = EVENT_ASSUMPTIONS[event_type]

    title = raw["title"]
    summary = raw["summary"]
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 200:
        raise AIOutputValidationError("The model returned an invalid scenario title.")
    if not isinstance(summary, str) or not summary.strip() or len(summary.strip()) > 1000:
        raise AIOutputValidationError("The model returned an invalid summary.")
    _verify_text_numbers(title, user_text)
    _verify_text_numbers(summary, user_text)

    affected = raw["affected_variables"]
    if not isinstance(affected, list) or len(affected) > 12 or any(item not in VARIABLE_NAMES for item in affected):
        raise AIOutputValidationError("The model returned unsupported affected variables.")
    if len(set(affected)) != len(affected):
        raise AIOutputValidationError("The model returned duplicate affected variables.")

    candidates = raw["assumptions"]
    if not isinstance(candidates, list) or len(candidates) > 12:
        raise AIOutputValidationError("The model returned too many assumptions.")
    assumptions: dict[str, float | int | str] = {}
    evidence: dict[str, str] = {}
    range_questions: list[str] = []
    category_questions: list[str] = []
    category_suggestions: list[dict[str, str]] = []
    unit_questions: list[str] = []
    for candidate in candidates:
        candidate_keys = {"name", "value", "unit", "evidence"}
        if not isinstance(candidate, dict) or set(candidate) != candidate_keys:
            raise AIOutputValidationError("The model returned a malformed assumption.")
        name = candidate["name"]
        value = candidate["value"]
        unit = candidate["unit"]
        quote = candidate["evidence"]
        if not isinstance(name, str) or name not in ASSUMPTION_NAMES or name not in event_fields:
            raise AIOutputValidationError("The model returned an assumption unrelated to the selected event.")
        if name in assumptions or name in evidence:
            raise AIOutputValidationError("The model returned a duplicate assumption.")
        if unit != ASSUMPTION_UNITS[name]:
            raise AIOutputValidationError("The model returned an assumption with the wrong unit.")
        if not isinstance(quote, str) or len(quote) > 300:
            raise AIOutputValidationError("The model returned invalid evidence.")

        if value is None:
            if quote.strip():
                raise AIOutputValidationError("Unknown assumptions must not include evidence.")
            continue
        if not quote.strip() or quote.casefold() not in user_text.casefold():
            raise AIOutputValidationError("A non-null assumption must quote exact user-provided text.")

        if unit == "category":
            if not isinstance(value, str):
                raise AIOutputValidationError("Expense category must be text.")
            detected_category = _expense_category_in_text(quote)
            custom_match = next((name for name in (custom_expense_names or []) if name.casefold() in quote.casefold()), None)
            proposed_category = value if value in EXPENSE_CATEGORIES else _expense_category_in_text(value)
            if custom_match and (value.casefold() == custom_match.casefold() or value == f"custom:{custom_match}"):
                assumptions[name] = f"custom:{custom_match}"
                evidence[name] = quote.strip()
                continue
            category_is_evidenced = (
                value.casefold() in quote.casefold()
                or value.replace("_", " ").casefold() in quote.casefold()
                or (detected_category is not None and proposed_category == detected_category)
            )
            if not category_is_evidenced:
                suggestion = _suggest_expense_category(value, quote)
                if suggestion:
                    category_suggestions.append(suggestion)
                    category_questions.append(
                        f"You wrote ‘{suggestion['mentioned']}’. Did you mean {suggestion['label']}? Reply yes to confirm, or choose another saved expense line."
                    )
                else:
                    category_questions.append(
                        "I could not match that expense to the user's wording. Which saved expense line should represent it: supplier costs, rent, staff salaries, or other expenses?"
                    )
                continue
            if detected_category is None or proposed_category != detected_category:
                suggestion = _suggest_expense_category(value, quote)
                if suggestion:
                    category_suggestions.append(suggestion)
                    category_questions.append(
                        f"You wrote ‘{suggestion['mentioned']}’. Did you mean {suggestion['label']}? Reply yes to confirm, or choose another saved expense line."
                    )
                else:
                    category_questions.append(
                        "That expense category is not modeled as a separate line yet. Which saved expense line should represent it: supplier costs, rent, staff salaries, or other expenses? Stratify will not choose one automatically."
                    )
                continue
            value = detected_category
        else:
            if isinstance(value, bool) or not isinstance(value, (int, float, str)):
                raise AIOutputValidationError("Numeric assumptions must be numeric values.")
            try:
                number = Decimal(str(value))
            except InvalidOperation:
                raise AIOutputValidationError("Numeric assumptions must be plain numeric values.") from None
            minimum, maximum = ASSUMPTION_BOUNDS[name]
            quoted_numbers = _numeric_tokens(quote)
            negative_expense_change = (
                name in {"expense_change_percent", "optimistic_expense_change_percent", "pessimistic_expense_change_percent"}
                and number < 0
                and abs(number) in quoted_numbers
                and any(
                    quote.casefold() in sentence.casefold() and DECREASE_PATTERN.search(sentence)
                    for sentence in re.split(r"(?<=[.!?])\s+|\n+", user_text)
                )
            )
            if number not in quoted_numbers and not negative_expense_change:
                raise AIOutputValidationError("Assumption value does not match its quoted evidence.")
            if unit == "percent" and not re.search(r"%|\bpercent\b|\bpercentage\b(?!\s+points?\b)", quote, re.IGNORECASE):
                unit_questions.append(
                    f"{name.replace('_', ' ')} needs an explicit percent unit. Please say a value with % or the word percent; no unit will be assumed."
                )
                continue
            if unit == "percentage_points" and not re.search(r"\bpercentage\s+points?\b|\bpp\b", quote, re.IGNORECASE):
                unit_questions.append(
                    f"{name.replace('_', ' ')} needs an explicit percentage-points unit. Please clarify the rate change unit."
                )
                continue
            if unit == "MYR" and not re.search(r"\bMYR\b|\bRM\b", quote, re.IGNORECASE):
                unit_questions.append(
                    f"{name.replace('_', ' ')} needs an explicit RM or MYR amount. Please clarify the currency and amount."
                )
                continue
            if not number.is_finite() or number < minimum or number > maximum:
                unit_label = "percentage points" if unit == "percentage_points" else "percent" if unit == "percent" else "MYR"
                range_questions.append(
                    f"{name.replace('_', ' ')} must be between {format(minimum, 'f')} and {format(maximum, 'f')} {unit_label}. Provide an explicit value in that unit; Stratify cannot convert a different unit."
                )
                continue
            value = str(number)
        assumptions[name] = value
        evidence[name] = quote.strip()

    missing = _strings(raw["missing_information"], "missing_information")
    questions = _strings(raw["follow_up_questions"], "follow_up_questions")
    for text in missing + questions:
        _verify_text_numbers(text, user_text)
    for question in range_questions + category_questions + unit_questions:
        if question.casefold() not in {item.casefold() for item in missing}:
            missing.append(question)
        if question.casefold() not in {item.casefold() for item in questions}:
            questions.append(question)
    required_assumptions, required_question = _required_assumptions(event_type)
    not_provided = required_assumptions - set(assumptions)
    if not_provided and not missing:
        missing.extend(required_question)
    elif not_provided and not questions:
        questions.extend(required_question)
    for question in missing:
        if question.casefold() not in {item.casefold() for item in questions}:
            questions.append(question)

    if event_type == "supplier_price_increase":
        primary = "supplier_cost_increase_percent"
        optimistic_key, pessimistic_key = "optimistic_supplier_cost_increase_percent", "pessimistic_supplier_cost_increase_percent"
    elif event_type == "sales_decrease":
        primary = "sales_decrease_percent"
        optimistic_key, pessimistic_key = "optimistic_sales_decrease_percent", "pessimistic_sales_decrease_percent"
    elif event_type == "expense_change":
        primary = "expense_change_percent"
        optimistic_key, pessimistic_key = "optimistic_expense_change_percent", "pessimistic_expense_change_percent"
    else:
        primary = optimistic_key = pessimistic_key = ""
    alternatives = {optimistic_key, pessimistic_key} if optimistic_key else set()
    provided_alternatives = alternatives & set(assumptions)
    invalid_alternatives = False
    if provided_alternatives and provided_alternatives != alternatives:
        question = "Provide both optimistic and pessimistic values, or leave both out."
        if question.casefold() not in {item.casefold() for item in missing}:
            missing.append(question)
        if question.casefold() not in {item.casefold() for item in questions}:
            questions.append(question)
    elif provided_alternatives == alternatives and alternatives:
        if not Decimal(str(assumptions[optimistic_key])) <= Decimal(str(assumptions[primary])) <= Decimal(str(assumptions[pessimistic_key])):
            invalid_alternatives = True
            question = "Adjust the optimistic and pessimistic assumptions so their outcomes are ordered correctly."
            if question.casefold() not in {item.casefold() for item in missing}:
                missing.append(question)
            if question.casefold() not in {item.casefold() for item in questions}:
                questions.append(question)
    if len(questions) > 8:
        questions = questions[:8]

    simulation_supported = event_type in {"supplier_price_increase", "sales_decrease", "expense_change", "major_customer_loss"}
    ready = simulation_supported and not missing and not (required_assumptions - set(assumptions)) and not (provided_alternatives and provided_alternatives != alternatives) and not invalid_alternatives
    return {
        "event_type": event_type,
        "title": title.strip(),
        "summary": ("I couldn't safely match that expense to a saved expense line. Please clarify before continuing." if category_questions else summary.strip()),
        "affected_variables": affected,
        "assumptions": assumptions,
        "assumption_evidence": evidence,
        "missing_information": missing,
        "follow_up_questions": questions,
        "simulation_supported": simulation_supported,
        "ready_for_confirmation": ready,
        "clarification_only": False,
        "expense_category_suggestion": category_suggestions[0] if category_suggestions else None,
    }


def validate_explanation(raw: Any, calculation: dict[str, Any] | None = None) -> dict[str, Any]:
    if not isinstance(raw, dict) or set(raw) != {"summary", "drivers", "limitations"}:
        raise AIOutputValidationError("The model returned an invalid explanation structure.")
    summary = raw["summary"]
    if not isinstance(summary, str) or not summary.strip() or len(summary.strip()) > 900:
        raise AIOutputValidationError("The model returned an invalid explanation summary.")
    drivers = raw["drivers"]
    if not isinstance(drivers, list) or len(drivers) > 5:
        raise AIOutputValidationError("The model returned an invalid explanation driver list.")
    for driver in drivers:
        if not isinstance(driver, dict) or set(driver) != {"metric", "direction", "explanation"}:
            raise AIOutputValidationError("The model returned a malformed explanation driver.")
        if driver["metric"] not in {"revenue", "expenses", "profit", "cash_flow"}:
            raise AIOutputValidationError("The model returned an unsupported explanation metric.")
        if driver["direction"] not in {"positive", "negative", "mixed", "unchanged", "unavailable"}:
            raise AIOutputValidationError("The model returned an unsupported explanation direction.")
        if not isinstance(driver["explanation"], str) or not driver["explanation"].strip() or len(driver["explanation"]) > 500:
            raise AIOutputValidationError("The model returned invalid driver text.")
        if calculation is not None:
            expected_direction = _calculation_direction(calculation, driver["metric"])
            if driver["direction"] != expected_direction:
                raise AIOutputValidationError("Explanation direction conflicts with the deterministic calculation.")
    limitations = _strings(raw["limitations"], "limitations", limit=5, max_length=400)
    texts = [summary, *(driver["explanation"] for driver in drivers), *limitations]
    if any(NUMBER_PATTERN.search(text) for text in texts):
        raise AIOutputValidationError("Explanations must not introduce or restate numeric results.")
    return {
        "summary": summary.strip(),
        "drivers": [{**driver, "explanation": driver["explanation"].strip()} for driver in drivers],
        "limitations": limitations,
    }


def _calculation_direction(calculation: dict[str, Any], metric: str) -> str:
    if metric == "cash_flow":
        return "unchanged" if calculation.get("cash_flow", {}).get("available") else "unavailable"
    baseline = calculation.get("baseline", {})
    estimate = calculation.get("estimate", {})
    if metric == "revenue":
        before, after = baseline.get("monthly_revenue"), estimate.get("monthly_revenue")
    elif metric == "expenses":
        before, after = baseline.get("total_expenses"), estimate.get("total_expenses")
    else:
        before, after = baseline.get("net_profit"), estimate.get("net_profit")
    try:
        difference = Decimal(str(after)) - Decimal(str(before))
    except (InvalidOperation, TypeError):
        raise AIOutputValidationError("The calculation is missing a value needed to validate its explanation.") from None
    return "positive" if difference > 0 else "negative" if difference < 0 else "unchanged"
