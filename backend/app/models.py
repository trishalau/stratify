from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("username", name="uq_users_username"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    businesses: Mapped[list["Business"]] = relationship(back_populates="owner")


class Business(Base):
    __tablename__ = "businesses"
    __table_args__ = (
        CheckConstraint("monthly_revenue >= 0", name="ck_business_revenue_nonnegative"),
        CheckConstraint("supplier_costs >= 0", name="ck_business_supplier_nonnegative"),
        CheckConstraint("rent >= 0", name="ck_business_rent_nonnegative"),
        CheckConstraint("staff_salaries >= 0", name="ck_business_salaries_nonnegative"),
        CheckConstraint("other_expenses >= 0", name="ck_business_other_expenses_nonnegative"),
        CheckConstraint("cash_balance >= 0", name="ck_business_cash_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    industry: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(160), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="MYR")
    monthly_revenue: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    supplier_costs: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    rent: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    staff_salaries: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    other_expenses: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    inventory_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    liabilities: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    custom_monthly_variables: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    scenarios: Mapped[list["Scenario"]] = relationship(
        back_populates="business",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    owner: Mapped[User] = relationship(back_populates="businesses")


class Scenario(Base):
    __tablename__ = "scenarios"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'confirmed')",
            name="ck_scenario_status_valid",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    assumptions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    missing_information: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business: Mapped[Business] = relationship(back_populates="scenarios")
