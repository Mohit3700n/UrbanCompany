from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app.models.booking import Booking
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import get_current_user, require_role
from app.models.user import User
from app.models.vendor import Vendor
from app.models.availability import (
    VendorWorkingHours,
    VendorUnavailableDate,
)
from app.schemas.availability import (
    WorkingHoursBulkInput,
    UnavailableDateInput,
)

router = APIRouter(prefix="/availability", tags=["Vendor Availability"])


def get_vendor(db: Session, user: User) -> Vendor:
    vendor = db.query(Vendor).filter(
        Vendor.user_id == user.id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found",
        )

    return vendor


# --------------------------------------------------
# 1. GET WEEKLY WORKING HOURS
# --------------------------------------------------

@router.get("/working-hours")
def get_working_hours(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor")),
):
    vendor = get_vendor(db, user)

    hours = (
        db.query(VendorWorkingHours)
        .filter(VendorWorkingHours.vendor_id == vendor.id)
        .order_by(VendorWorkingHours.day_of_week)
        .all()
    )

    return {
        "success": True,
        "working_hours": [
            {
                "id": item.id,
                "day_of_week": item.day_of_week,
                "start_time": item.start_time.strftime("%H:%M"),
                "end_time": item.end_time.strftime("%H:%M"),
                "is_available": item.is_available,
            }
            for item in hours
        ],
    }


# --------------------------------------------------
# 2. SET / REPLACE WEEKLY WORKING HOURS
# --------------------------------------------------

@router.put("/working-hours")
def set_working_hours(
    payload: WorkingHoursBulkInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor")),
):
    vendor = get_vendor(db, user)

    days = [item.day_of_week for item in payload.working_hours]

    if len(days) != len(set(days)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate day_of_week values are not allowed",
        )

    try:
        # Replace the vendor's complete weekly schedule.
        db.query(VendorWorkingHours).filter(
            VendorWorkingHours.vendor_id == vendor.id
        ).delete(synchronize_session=False)

        for item in payload.working_hours:
            db.add(
                VendorWorkingHours(
                    vendor_id=vendor.id,
                    day_of_week=item.day_of_week,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    is_available=item.is_available,
                )
            )

        db.commit()

    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "message": "Working hours updated successfully",
        "days_configured": len(payload.working_hours),
    }


# --------------------------------------------------
# 3. ADD UNAVAILABLE DATE
# --------------------------------------------------

@router.post("/unavailable-dates")
def add_unavailable_date(
    payload: UnavailableDateInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor")),
):
    vendor = get_vendor(db, user)

    if payload.unavailable_date < date.today():
        raise HTTPException(
            status_code=400,
            detail="Cannot block a date in the past",
        )

    existing = db.query(VendorUnavailableDate).filter(
        VendorUnavailableDate.vendor_id == vendor.id,
        VendorUnavailableDate.unavailable_date == payload.unavailable_date,
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This date is already marked unavailable",
        )

    unavailable = VendorUnavailableDate(
        vendor_id=vendor.id,
        unavailable_date=payload.unavailable_date,
        reason=payload.reason,
    )

    db.add(unavailable)
    db.commit()
    db.refresh(unavailable)

    return {
        "success": True,
        "message": "Unavailable date added successfully",
        "unavailable_date": {
            "id": unavailable.id,
            "date": unavailable.unavailable_date.isoformat(),
            "reason": unavailable.reason,
        },
    }


# --------------------------------------------------
# 4. GET UNAVAILABLE DATES
# --------------------------------------------------

@router.get("/unavailable-dates")
def get_unavailable_dates(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor")),
):
    vendor = get_vendor(db, user)

    dates = (
        db.query(VendorUnavailableDate)
        .filter(VendorUnavailableDate.vendor_id == vendor.id)
        .order_by(VendorUnavailableDate.unavailable_date)
        .all()
    )

    return {
        "success": True,
        "unavailable_dates": [
            {
                "id": item.id,
                "date": item.unavailable_date.isoformat(),
                "reason": item.reason,
            }
            for item in dates
        ],
    }


# --------------------------------------------------
# 5. REMOVE UNAVAILABLE DATE
# --------------------------------------------------

@router.delete("/unavailable-dates/{unavailable_id}")
def remove_unavailable_date(
    unavailable_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("vendor")),
):
    vendor = get_vendor(db, user)

    unavailable = db.query(VendorUnavailableDate).filter(
        VendorUnavailableDate.id == unavailable_id,
        VendorUnavailableDate.vendor_id == vendor.id,
    ).first()

    if not unavailable:
        raise HTTPException(
            status_code=404,
            detail="Unavailable date not found",
        )

    db.delete(unavailable)
    db.commit()

    return {
        "success": True,
        "message": "Unavailable date removed successfully",
    }
    

# --------------------------------------------------
# 6. GET AVAILABLE TIME SLOTS
# --------------------------------------------------


@router.get("/slots")
def get_available_slots(
    vendor_id: int = Query(gt=0),
    requested_date: date = Query(),
    duration_minutes: int = Query(default=60, ge=15, le=480),
    slot_interval_minutes: int = Query(default=30, ge=15, le=120),
    db: Session = Depends(get_db),
):
    india_tz = ZoneInfo("Asia/Kolkata")

    # 1. Validate requested date
    today = datetime.now(india_tz).date()

    if requested_date < today:
        raise HTTPException(
            status_code=400,
            detail="Cannot check availability for a past date",
        )

    # 2. Find vendor
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.status == "approved",
        Vendor.is_active.is_(True),
        Vendor.accepting_requests.is_(True),
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Active approved vendor not found",
        )

    # 3. Check unavailable date
    unavailable = db.query(VendorUnavailableDate).filter(
        VendorUnavailableDate.vendor_id == vendor.id,
        VendorUnavailableDate.unavailable_date == requested_date,
    ).first()

    if unavailable:
        return {
            "success": True,
            "status": "unavailable",
            "message": "Vendor is unavailable on this date",
            "requested_date": requested_date.isoformat(),
            "slots": [],
        }

    # 4. Find working hours
    day_of_week = requested_date.weekday()

    working_hours = db.query(VendorWorkingHours).filter(
        VendorWorkingHours.vendor_id == vendor.id,
        VendorWorkingHours.day_of_week == day_of_week,
        VendorWorkingHours.is_available.is_(True),
    ).first()

    if not working_hours:
        return {
            "success": True,
            "status": "closed",
            "message": "Vendor does not work on this day",
            "requested_date": requested_date.isoformat(),
            "slots": [],
        }

    # 5. Generate local working-hour boundaries
    opening = datetime.combine(
        requested_date,
        working_hours.start_time,
    ).replace(tzinfo=india_tz)

    closing = datetime.combine(
        requested_date,
        working_hours.end_time,
    ).replace(tzinfo=india_tz)

    # 6. Find existing bookings for this vendor and date
    day_start_utc = opening.astimezone(timezone.utc)
    day_end_utc = closing.astimezone(timezone.utc)

    existing_bookings = db.query(Booking).filter(
        Booking.vendor_id == vendor.id,
        Booking.status.in_([
            "pending",
            "accepted",
            "in_progress",
        ]),
        Booking.start_at < day_end_utc,
        Booking.end_at > day_start_utc,
    ).all()

    # 7. Generate only non-overlapping future slots
    duration = timedelta(minutes=duration_minutes)
    interval = timedelta(minutes=slot_interval_minutes)

    current_slot = opening
    now = datetime.now(india_tz)

    slots = []

    while current_slot + duration <= closing:
        slot_end = current_slot + duration

        # Do not show slots that have already started
        if current_slot > now:
            overlaps = any(
                booking.start_at < slot_end.astimezone(timezone.utc)
                and booking.end_at > current_slot.astimezone(timezone.utc)
                for booking in existing_bookings
            )

            if not overlaps:
                slots.append({
                    "start_time": current_slot.strftime("%H:%M"),
                    "end_time": slot_end.strftime("%H:%M"),
                })

        current_slot += interval

    return {
        "success": True,
        "status": "slots_found" if slots else "no_slots",
        "vendor_id": vendor.id,
        "business_name": vendor.business_name,
        "requested_date": requested_date.isoformat(),
        "duration_minutes": duration_minutes,
        "slot_interval_minutes": slot_interval_minutes,
        "total_slots": len(slots),
        "availability_type": "schedule_and_booking_based",
        "bookings_considered": len(existing_bookings),
        "slots": slots,
    }

    