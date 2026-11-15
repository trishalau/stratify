from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Business


def seed_demo_business(session: Session, owner_id: int) -> Business:
    existing = session.scalar(
        select(Business).where(Business.name == "KL Electronics Sdn. Bhd.")
    )
    if existing:
        if existing.owner_id != owner_id:
            raise ValueError("The demo business already belongs to another account.")
        return existing

    business = Business(
        owner_id=owner_id,
        name="KL Electronics Sdn. Bhd.",
        industry="Consumer electronics retail",
        location="Kuala Lumpur, Malaysia",
        currency="MYR",
        monthly_revenue=Decimal("120000.00"),
        supplier_costs=Decimal("40000.00"),
        rent=Decimal("10000.00"),
        staff_salaries=Decimal("20000.00"),
        other_expenses=Decimal("12000.00"),
        cash_balance=Decimal("160000.00"),
        inventory_value=None,
        liabilities=None,
    )
    session.add(business)
    session.flush()
    return business
