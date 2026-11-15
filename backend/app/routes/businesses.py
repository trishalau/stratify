from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import select

from ..models import Business
from ..serializers import business_to_dict
from ..validation import parse_business_payload

bp = Blueprint("businesses", __name__)


@bp.get("/businesses")
def list_businesses():
    businesses = g.db_session.scalars(select(Business).where(Business.owner_id == g.current_user.id).order_by(Business.name)).all()
    return jsonify({"data": [business_to_dict(item) for item in businesses]})


@bp.post("/businesses")
def create_business():
    if current_app.config.get("STRATIFY_DEMO_MODE"):
        return jsonify({"error": "Business profile changes in demo mode are temporary and must remain in the frontend session."}), 403
    payload = parse_business_payload(request.get_json(silent=True))
    business = Business(**payload, owner_id=g.current_user.id)
    g.db_session.add(business)
    g.db_session.commit()
    return jsonify({"data": business_to_dict(business)}), 201


@bp.get("/businesses/<int:business_id>")
def get_business(business_id: int):
    business = g.db_session.scalar(select(Business).where(Business.id == business_id, Business.owner_id == g.current_user.id))
    if business is None:
        return jsonify({"error": "Business not found."}), 404
    return jsonify({"data": business_to_dict(business)})


@bp.patch("/businesses/<int:business_id>")
def update_business(business_id: int):
    if current_app.config.get("STRATIFY_DEMO_MODE"):
        return jsonify({"error": "Business profile changes in demo mode are temporary and are not saved to PostgreSQL."}), 403
    business = g.db_session.scalar(select(Business).where(Business.id == business_id, Business.owner_id == g.current_user.id))
    if business is None:
        return jsonify({"error": "Business not found."}), 404

    changes = parse_business_payload(request.get_json(silent=True), partial=True)
    for field, value in changes.items():
        setattr(business, field, value)
    g.db_session.commit()
    return jsonify({"data": business_to_dict(business)})


@bp.delete("/businesses/<int:business_id>")
def delete_business(business_id: int):
    if current_app.config.get("STRATIFY_DEMO_MODE"):
        return jsonify({"error": "The fictional demo business cannot be deleted in demo mode."}), 403
    business = g.db_session.scalar(select(Business).where(Business.id == business_id, Business.owner_id == g.current_user.id))
    if business is None:
        return jsonify({"error": "Business not found."}), 404
    g.db_session.delete(business)
    g.db_session.commit()
    return "", 204
