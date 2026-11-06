from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id: Mapped[int] = mapped_column(primary_key=True)

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("service_categories.id"),
        nullable=True,
        index=True
    )

    problem_description: Mapped[str] = mapped_column(Text)

    location: Mapped[str] = mapped_column(String(300))

    preferred_date: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    preferred_time: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    urgency: Mapped[str] = mapped_column(
        String(20),
        default="normal"
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="open",
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )