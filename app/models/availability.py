from datetime import date, time

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class VendorWorkingHours(Base):
    __tablename__ = "vendor_working_hours"

    __table_args__ = (
        UniqueConstraint(
            "vendor_id",
            "day_of_week",
            name="uq_vendor_working_day",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"),
        index=True,
    )

    # Monday = 0, Sunday = 6
    day_of_week: Mapped[int] = mapped_column(Integer)

    start_time: Mapped[time] = mapped_column(Time)

    end_time: Mapped[time] = mapped_column(Time)

    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )


class VendorUnavailableDate(Base):
    __tablename__ = "vendor_unavailable_dates"

    id: Mapped[int] = mapped_column(primary_key=True)

    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"),
        index=True,
    )

    unavailable_date: Mapped[date] = mapped_column(
        Date,
        index=True,
    )

    reason: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )