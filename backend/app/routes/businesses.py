from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from ..models import Business
from ..serializers import business_to_dict
from ..validation import parse_business_payload

bp = Blueprint("businesses", __name__)


@bp.get("/businesses")
def list_businesses():
    businesses = g.db_session.scalars(select(Business).order_by(Business.name)).all()
    return jsonify({"data": [business_to_dict(item) for item in businesses]})


@bp.post("/businesses")
def create_business():
    payload = parse_business_payload(request.get_json(silent=True))
    business = Business(**payload)
    g.db_session.add(business)
    g.db_session.commit()
    return jsonify({"data": business_to_dict(business)}), 201


@bp.get("/businesses/<int:business_id>")
def get_business(business_id: int):
    business = g.db_session.get(Business, business_id)
    if business is None:
        return jsonify({"error": "Business not found."}), 404
    return jsonify({"data": business_to_dict(business)})


@bp.patch("/businesses/<int:business_id>")
def update_business(business_id: int):
    business = g.db_session.get(Business, business_id)
    if business is None:
        return jsonify({"error": "Business not found."}), 404

    changes = parse_business_payload(request.get_json(silent=True), partial=True)
    for field, value in changes.items():
        setattr(business, field, value)
    g.db_session.commit()
    return jsonify({"data": business_to_dict(business)})
