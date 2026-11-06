from sqlalchemy import String, Boolean, ForeignKey, Float, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Vendor(Base):
    __tablename__ = "vendors"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    business_name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    accepting_requests: Mapped[bool] = mapped_column(Boolean, default=True)

class VendorService(Base):
    __tablename__ = "vendor_services"
    __table_args__ = (UniqueConstraint("vendor_id", "category_id", name="uq_vendor_category"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("service_categories.id"), index=True)
    skill_description: Mapped[str | None] = mapped_column(String(250), nullable=True)

class VendorLocation(Base):
    __tablename__ = "vendor_locations"
    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), unique=True, index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    address_label: Mapped[str] = mapped_column(String(300))
