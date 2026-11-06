from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id"),
        index=True
    )
    
    service_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("service_requests.id"),
        nullable=True,
        index=True
    )

    problem_description: Mapped[str] = mapped_column(Text)

    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    end_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        index=True
    )

    # Arrival OTP
    arrival_otp_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True
    )

    arrival_otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    arrival_otp_verified: Mapped[bool] = mapped_column(
        default=False
    )

    # Completion OTP
    completion_otp_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True
    )

    completion_otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    completion_otp_verified: Mapped[bool] = mapped_column(
        default=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    __table_args__ = (
        Index(
            "ix_booking_vendor_time",
            "vendor_id",
            "start_at",
            "end_at"
        ),
    )