import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.schemas.booking import OTPVerify
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import require_role

from app.models.user import User
from app.models.vendor import Vendor, VendorService
from app.models.availability import (
    VendorWorkingHours,
    VendorUnavailableDate,
)
from app.models.booking import Booking

from app.schemas.booking import (
    BookingCreate,
    BookingOut,
    CustomerBookingHistoryOut,
    VendorBookingRequestOut,
)

from app.models.service_request import ServiceRequest

router = APIRouter(prefix="/bookings", tags=["Bookings"])

INDIA_TZ = ZoneInfo("Asia/Kolkata")

ACTIVE_BOOKING_STATUSES = ["pending", "accepted"]

ALLOWED_BOOKING_STATUSES = {
    "pending",
    "accepted",
    "in_progress",
    "rejected",
    "cancelled",
    "completed",
}

CANCELLATION_CUTOFF_HOURS = 2


# --------------------------------------------------
# Helper functions
# --------------------------------------------------

def get_vendor_for_user(db: Session, user: User):
    vendor = db.query(Vendor).filter(
        Vendor.user_id == user.id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found"
        )

    return vendor


def get_booking_for_customer(
    db: Session,
    booking_id: int,
    user: User
):
    booking = db.query(Booking).filter(
        Booking.id == booking_id
    ).with_for_update().first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if booking.customer_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access this booking"
        )

    return booking


def get_booking_for_vendor(
    db: Session,
    booking_id: int,
    user: User
):
    vendor = get_vendor_for_user(db, user)

    booking = db.query(Booking).filter(
        Booking.id == booking_id
    ).with_for_update().first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if booking.vendor_id != vendor.id:
        raise HTTPException(
            status_code=403,
            detail="This booking does not belong to your business"
        )

    return booking


# --------------------------------------------------
# 1. CUSTOMER BOOKING HISTORY
# --------------------------------------------------

@router.get(
    "/my",
    response_model=list[CustomerBookingHistoryOut]
)
def customer_booking_history(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    results = (
        db.query(Booking, Vendor.business_name)
        .join(Vendor, Booking.vendor_id == Vendor.id)
        .filter(Booking.customer_id == user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )

    return [
        {
            "id": booking.id,
            "vendor_id": booking.vendor_id,
            "vendor_business_name": business_name,
            "problem_description": booking.problem_description,
            "start_at": booking.start_at,
            "end_at": booking.end_at,
            "status": booking.status,
            "created_at": booking.created_at,
        }
        for booking, business_name in results
    ]


# --------------------------------------------------
# 2. VENDOR INCOMING BOOKING REQUESTS
# --------------------------------------------------

@router.get(
    "/vendor/requests",
    response_model=list[VendorBookingRequestOut]
)
def vendor_booking_requests(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor"))
):
    vendor = get_vendor_for_user(db, user)

    query = (
        db.query(Booking, User.full_name)
        .join(User, Booking.customer_id == User.id)
        .filter(Booking.vendor_id == vendor.id)
    )

    if status:
        if status not in ALLOWED_BOOKING_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid booking status"
            )

        query = query.filter(Booking.status == status)

    results = query.order_by(
        Booking.created_at.desc()
    ).all()

    return [
        {
            "id": booking.id,
            "customer_id": booking.customer_id,
            "customer_name": customer_name,
            "problem_description": booking.problem_description,
            "start_at": booking.start_at,
            "end_at": booking.end_at,
            "status": booking.status,
            "created_at": booking.created_at,
        }
        for booking, customer_name in results
    ]


# --------------------------------------------------
# 3. CREATE BOOKING
# --------------------------------------------------

@router.post(
    "/",
    response_model=BookingOut,
    status_code=201
)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    try:
        vendor = db.query(Vendor).filter(
            Vendor.id == payload.vendor_id,
            Vendor.status == "approved",
            Vendor.is_active.is_(True),
            Vendor.accepting_requests.is_(True),
        ).first()

        if not vendor:
            raise HTTPException(
                status_code=404,
                detail="Available vendor not found"
            )
            
        service_request = None

        if payload.service_request_id is not None:
            service_request = (
                db.query(ServiceRequest)
                .filter(
                    ServiceRequest.id == payload.service_request_id
                )
                .with_for_update()
                .first()
            )

            if not service_request:
                raise HTTPException(
                    status_code=404,
                    detail="Service request not found"
                )

            if service_request.customer_id != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="This service request does not belong to you"
                )

            if service_request.status != "open":
                raise HTTPException(
                    status_code=400,
                    detail="This service request is not available for booking"
                )

            if service_request.category_id is not None:
                vendor_offers_category = db.query(VendorService).filter(
                    VendorService.vendor_id == vendor.id,
                    VendorService.category_id == service_request.category_id
                ).first()

                if not vendor_offers_category:
                    raise HTTPException(
                        status_code=400,
                        detail="Selected vendor does not offer this service category"
                    )

        # Serialize booking creation for this vendor.
        db.execute(
            text("SELECT pg_advisory_xact_lock(:vendor_id)"),
            {"vendor_id": vendor.id},
        )

        local_start = payload.start_at.astimezone(INDIA_TZ)
        local_end = payload.end_at.astimezone(INDIA_TZ)

        if local_start.date() != local_end.date():
            raise HTTPException(
                status_code=400,
                detail="Bookings crossing midnight are not supported"
            )

        requested_date = local_start.date()
        day_of_week = requested_date.weekday()

        working_hours = db.query(VendorWorkingHours).filter(
            VendorWorkingHours.vendor_id == vendor.id,
            VendorWorkingHours.day_of_week == day_of_week,
            VendorWorkingHours.is_available.is_(True),
        ).first()

        if not working_hours:
            raise HTTPException(
                status_code=400,
                detail="Vendor does not work on this day"
            )

        local_start_time = local_start.time().replace(tzinfo=None)
        local_end_time = local_end.time().replace(tzinfo=None)

        if (
            local_start_time < working_hours.start_time
            or local_end_time > working_hours.end_time
        ):
            raise HTTPException(
                status_code=400,
                detail="Requested time is outside vendor working hours"
            )

        unavailable = db.query(VendorUnavailableDate).filter(
            VendorUnavailableDate.vendor_id == vendor.id,
            VendorUnavailableDate.unavailable_date == requested_date,
        ).first()

        if unavailable:
            raise HTTPException(
                status_code=400,
                detail="Vendor is unavailable on the requested date"
            )

        overlapping_booking = db.query(Booking).filter(
            Booking.vendor_id == vendor.id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.start_at < payload.end_at,
            Booking.end_at > payload.start_at,
        ).first()

        if overlapping_booking:
            raise HTTPException(
                status_code=409,
                detail="This time slot is already booked or reserved"
            )

        booking = Booking(
            customer_id=user.id,
            vendor_id=vendor.id,
            service_request_id=(
                service_request.id if service_request else None
            ),
            problem_description=payload.problem_description,
            start_at=payload.start_at,
            end_at=payload.end_at,
            status="pending",
        )

        if service_request:
            service_request.status = "booking_created"

        db.add(booking)
        db.commit()
        db.refresh(booking)

        return booking

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# 4. ACCEPT BOOKING
# --------------------------------------------------

@router.patch(
    "/{booking_id}/accept",
    response_model=BookingOut
)
def accept_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor"))
):
    try:
        booking = get_booking_for_vendor(
            db, booking_id, user
        )

        if booking.status != "pending":
            raise HTTPException(
                status_code=400,
                detail="Only pending bookings can be accepted"
            )

        if booking.start_at <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400,
                detail="Cannot accept a booking after its scheduled start time"
            )

        booking.status = "accepted"

        db.commit()
        db.refresh(booking)

        return booking

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# 5. REJECT BOOKING
# --------------------------------------------------

@router.patch(
    "/{booking_id}/reject",
    response_model=BookingOut
)
def reject_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor"))
):
    try:
        booking = get_booking_for_vendor(
            db, booking_id, user
        )

        if booking.status != "pending":
            raise HTTPException(
                status_code=400,
                detail="Only pending bookings can be rejected"
            )

        booking.status = "rejected"

        db.commit()
        db.refresh(booking)

        return booking

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# 6. CANCEL BOOKING
# --------------------------------------------------

@router.patch(
    "/{booking_id}/cancel",
    response_model=BookingOut
)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    try:
        booking = get_booking_for_customer(
            db, booking_id, user
        )

        if booking.status not in ["pending", "accepted"]:
            raise HTTPException(
                status_code=400,
                detail="This booking cannot be cancelled"
            )

        now = datetime.now(timezone.utc)

        if booking.start_at <= now:
            raise HTTPException(
                status_code=400,
                detail="Cannot cancel after the scheduled start time"
            )

        if booking.status == "accepted":
            remaining_time = booking.start_at - now

            if remaining_time.total_seconds() < (
                CANCELLATION_CUTOFF_HOURS * 3600
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Accepted bookings must be cancelled "
                        "at least 2 hours before the scheduled start"
                    )
                )

        booking.status = "cancelled"

        db.commit()
        db.refresh(booking)

        return booking

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# 7. COMPLETE BOOKING
# --------------------------------------------------
    
def generate_otp():
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(booking_id: int, otp: str):
    value = f"{booking_id}:{otp}"
    return hashlib.sha256(value.encode()).hexdigest()


def verify_otp(
    booking_id: int,
    submitted_otp: str,
    stored_hash: str | None,
    expires_at: datetime | None
):
    if not stored_hash or not expires_at:
        return False

    now = datetime.now(timezone.utc)

    if expires_at <= now:
        return False

    submitted_hash = hash_otp(booking_id, submitted_otp)

    return secrets.compare_digest(submitted_hash, stored_hash)


@router.post("/{booking_id}/arrival-otp")
def generate_arrival_otp(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    try:
        booking = get_booking_for_customer(db, booking_id, user)

        if booking.status != "accepted":
            raise HTTPException(
                status_code=400,
                detail="Arrival OTP can only be generated for accepted bookings"
            )

        otp = generate_otp()

        booking.arrival_otp_hash = hash_otp(booking.id, otp)
        booking.arrival_otp_expires_at = (
            datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        booking.arrival_otp_verified = False

        db.commit()

        return {
            "message": "Arrival OTP generated successfully",
            "booking_id": booking.id,
            "otp": otp,
            "expires_in_minutes": 5
        }

    except Exception:
        db.rollback()
        raise
    
    
@router.post("/{booking_id}/verify-arrival")
def verify_arrival_otp(
    booking_id: int,
    payload: OTPVerify,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor"))
):
    try:
        booking = get_booking_for_vendor(db, booking_id, user)

        if booking.status != "accepted":
            raise HTTPException(
                status_code=400,
                detail="Only accepted bookings can start"
            )

        is_valid = verify_otp(
            booking.id,
            payload.otp,
            booking.arrival_otp_hash,
            booking.arrival_otp_expires_at
        )

        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired arrival OTP"
            )

        booking.arrival_otp_verified = True
        booking.arrival_otp_hash = None
        booking.arrival_otp_expires_at = None
        booking.status = "in_progress"

        db.commit()

        return {
            "message": "Arrival verified. Service started successfully",
            "booking_id": booking.id,
            "status": booking.status
        }

    except Exception:
        db.rollback()
        raise
    

@router.post("/{booking_id}/completion-otp")
def generate_completion_otp(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    try:
        booking = get_booking_for_customer(db, booking_id, user)

        if booking.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail="Completion OTP requires an in-progress booking"
            )

        otp = generate_otp()

        booking.completion_otp_hash = hash_otp(booking.id, otp)
        booking.completion_otp_expires_at = (
            datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        booking.completion_otp_verified = False

        db.commit()

        return {
            "message": "Completion OTP generated successfully",
            "booking_id": booking.id,
            "otp": otp,
            "expires_in_minutes": 5
        }

    except Exception:
        db.rollback()
        raise
    
@router.post("/{booking_id}/verify-completion")
def verify_completion_otp(
    booking_id: int,
    payload: OTPVerify,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor"))
):
    try:
        booking = get_booking_for_vendor(db, booking_id, user)

        if booking.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail="Only in-progress bookings can be completed"
            )

        is_valid = verify_otp(
            booking.id,
            payload.otp,
            booking.completion_otp_hash,
            booking.completion_otp_expires_at
        )

        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired completion OTP"
            )

        booking.completion_otp_verified = True
        booking.completion_otp_hash = None
        booking.completion_otp_expires_at = None
        booking.status = "completed"

        db.commit()

        return {
            "message": "Completion verified. Service completed successfully",
            "booking_id": booking.id,
            "status": booking.status
        }

    except Exception:
        db.rollback()
        raise