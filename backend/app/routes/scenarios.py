from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import select

from ..models import Business, Scenario, utc_now
from ..serializers import business_to_dict, scenario_to_dict
from ..validation import RequestValidationError, parse_scenario_payload
from ..ai_contracts import AIOutputValidationError, validate_explanation, validate_interpretation
from ..ai_provider import AIConfigurationError, AIIntegrationError
from stratify_engine import FinancialEngineError, simulate_scenario

bp = Blueprint("scenarios", __name__)
MAX_CHAT_MESSAGES = 24
MAX_CHAT_MESSAGE_LENGTH = 3000
MAX_CHAT_TOTAL_LENGTH = 8000


def _parse_chat_messages(payload):
    if not isinstance(payload, dict) or set(payload) != {"messages"}:
        raise RequestValidationError("Request body must contain only a messages list.")
    messages = payload["messages"]
    if not isinstance(messages, list) or not 1 <= len(messages) <= MAX_CHAT_MESSAGES:
        raise RequestValidationError("Provide between 1 and 12 chat messages.", {"messages": "Message count is outside the supported range."})

    normalized = []
    total_length = 0
    for index, item in enumerate(messages):
        if not isinstance(item, dict) or set(item) != {"role", "content"}:
            raise RequestValidationError("Each message needs a role and content.", {"messages": f"Message {index + 1} is invalid."})
        role, content = item["role"], item["content"]
        if not isinstance(role, str) or role not in {"user", "assistant"} or not isinstance(content, str) or not content.strip():
            raise RequestValidationError("Chat messages must contain user or assistant text.", {"messages": f"Message {index + 1} is invalid."})
        if len(content) > MAX_CHAT_MESSAGE_LENGTH:
            raise RequestValidationError("A chat message is too long.", {"messages": "Each message is limited to 3,000 characters."})
        total_length += len(content)
        normalized.append({"role": role, "content": content.strip()})
    if total_length > MAX_CHAT_TOTAL_LENGTH:
        raise RequestValidationError("Conversation is too long.", {"messages": "Keep the conversation under 8,000 characters."})
    if normalized[-1]["role"] != "user":
        raise RequestValidationError("The latest chat message must be from the user.", {"messages": "Send a user message to continue."})
    user_text = "\n".join(item["content"] for item in normalized if item["role"] == "user")
    return normalized, user_text


def _find_scenario(scenario_id: int) -> Scenario | None:
    return g.db_session.get(Scenario, scenario_id)


@bp.get("/businesses/<int:business_id>/scenarios")
def list_scenarios(business_id: int):
    if g.db_session.get(Business, business_id) is None:
        return jsonify({"error": "Business not found."}), 404
    items = g.db_session.scalars(
        select(Scenario)
        .where(Scenario.business_id == business_id)
        .order_by(Scenario.created_at.desc(), Scenario.id.desc())
    ).all()
    return jsonify({"data": [scenario_to_dict(item) for item in items]})


@bp.post("/businesses/<int:business_id>/scenarios")
def create_scenario(business_id: int):
    if g.db_session.get(Business, business_id) is None:
        return jsonify({"error": "Business not found."}), 404
    payload = parse_scenario_payload(request.get_json(silent=True))
    scenario = Scenario(business_id=business_id, **payload, status="draft")
    g.db_session.add(scenario)
    g.db_session.commit()
    return jsonify({"data": scenario_to_dict(scenario)}), 201


@bp.post("/businesses/<int:business_id>/scenarios/interpret")
def interpret_scenario(business_id: int):
    business = g.db_session.get(Business, business_id)
    if business is None:
        return jsonify({"error": "Business not found."}), 404
    messages, user_text = _parse_chat_messages(request.get_json(silent=True))
    profile = business_to_dict(business)
    available_fields = [name for name, value in profile.items() if value is not None and name not in {"id", "created_at", "updated_at"}]

    try:
        raw = current_app.extensions["scenario_ai"].interpret(messages, available_fields)
        result = validate_interpretation(raw, user_text)
    except AIConfigurationError as error:
        return jsonify({"error": str(error)}), 503
    except AIIntegrationError as error:
        current_app.logger.exception("Scenario interpretation provider request failed")
        return jsonify({"error": error.public_message}), 502
    except AIOutputValidationError as error:
        current_app.logger.warning("Scenario interpretation failed application validation: %s", error)
        question = (
            "I couldn't safely map part of that description to the scenario fields. "
            "Which business item changes? If you know the figure, include digits and a unit such as % or RM; otherwise tell me what is still unknown."
        )
        return jsonify({"data": {
            "event_type": "custom",
            "title": "Let's clarify this scenario",
            "summary": "I need one more detail before I can safely interpret this event. No assumptions have been accepted.",
            "affected_variables": [],
            "assumptions": {},
            "assumption_evidence": {},
            "missing_information": [question],
            "follow_up_questions": [question],
            "simulation_supported": False,
            "ready_for_confirmation": False,
            "clarification_only": True,
        }})
    return jsonify({"data": result})


@bp.get("/scenarios/<int:scenario_id>")
def get_scenario(scenario_id: int):
    scenario = _find_scenario(scenario_id)
    if scenario is None:
        return jsonify({"error": "Scenario not found."}), 404
    return jsonify({"data": scenario_to_dict(scenario)})


@bp.patch("/scenarios/<int:scenario_id>")
def update_scenario(scenario_id: int):
    scenario = _find_scenario(scenario_id)
    if scenario is None:
        return jsonify({"error": "Scenario not found."}), 404
    if scenario.status != "draft":
        return jsonify({"error": "Confirmed assumptions cannot be edited. Create a new draft."}), 409

    changes = parse_scenario_payload(request.get_json(silent=True), partial=True)
    for field, value in changes.items():
        setattr(scenario, field, value)
    g.db_session.commit()
    return jsonify({"data": scenario_to_dict(scenario)})


@bp.post("/scenarios/<int:scenario_id>/confirm")
def confirm_scenario(scenario_id: int):
    scenario = _find_scenario(scenario_id)
    if scenario is None:
        return jsonify({"error": "Scenario not found."}), 404
    if scenario.status == "confirmed":
        return jsonify({"data": scenario_to_dict(scenario)})

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or payload != {"confirmed": True}:
        raise RequestValidationError(
            "Explicit confirmation is required.",
            {"confirmed": "Send {\"confirmed\": true} after reviewing assumptions."},
        )
    if not scenario.assumptions:
        raise RequestValidationError(
            "Scenario assumptions are incomplete.",
            {"assumptions": "Add and review at least one assumption before confirming."},
        )
    if scenario.missing_information:
        raise RequestValidationError(
            "Scenario still has missing information.",
            {"missing_information": "Resolve the listed items before confirming."},
        )

    scenario.status = "confirmed"
    scenario.confirmed_at = utc_now()
    g.db_session.commit()
    return jsonify({"data": scenario_to_dict(scenario)})


@bp.post("/scenarios/<int:scenario_id>/simulate")
def run_scenario(scenario_id: int):
    scenario = _find_scenario(scenario_id)
    if scenario is None:
        return jsonify({"error": "Scenario not found."}), 404
    if scenario.status != "confirmed":
        return jsonify({"error": "Confirm the scenario assumptions before simulating."}), 409
    if scenario.missing_information:
        return jsonify({"error": "Resolve missing information before simulating."}), 409

    business = g.db_session.get(Business, scenario.business_id)
    if business is None:
        return jsonify({"error": "Business not found."}), 404

    try:
        result = simulate_scenario(business_to_dict(business), scenario_to_dict(scenario))
    except FinancialEngineError as error:
        return jsonify({"error": str(error), "fields": {error.field: str(error)}}), 422
    return jsonify({"data": result})


@bp.post("/scenarios/<int:scenario_id>/explain")
def explain_scenario(scenario_id: int):
    scenario = _find_scenario(scenario_id)
    if scenario is None:
        return jsonify({"error": "Scenario not found."}), 404
    if scenario.status != "confirmed":
        return jsonify({"error": "Confirm scenario assumptions before requesting an explanation."}), 409
    business = g.db_session.get(Business, scenario.business_id)
    if business is None:
        return jsonify({"error": "Business not found."}), 404

    try:
        calculation = simulate_scenario(business_to_dict(business), scenario_to_dict(scenario))
    except FinancialEngineError as error:
        return jsonify({"error": str(error), "fields": {error.field: str(error)}}), 422
    try:
        raw = current_app.extensions["scenario_ai"].explain(calculation)
        explanation = validate_explanation(raw, calculation)
    except AIConfigurationError as error:
        return jsonify({"error": str(error)}), 503
    except AIIntegrationError as error:
        current_app.logger.exception("Simulation explanation provider request failed")
        return jsonify({"error": f"{error.public_message} The deterministic calculation is unchanged."}), 502
    except AIOutputValidationError:
        current_app.logger.exception("Simulation explanation failed application validation")
        return jsonify({"error": "AI explanation did not pass validation. The deterministic calculation is unchanged."}), 502
    return jsonify({"data": {"calculation": calculation, "explanation": explanation}})
