from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from ..models import Business, Scenario, utc_now
from ..serializers import business_to_dict, scenario_to_dict
from ..validation import RequestValidationError, parse_scenario_payload
from stratify_engine import FinancialEngineError, simulate_scenario

bp = Blueprint("scenarios", __name__)


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
