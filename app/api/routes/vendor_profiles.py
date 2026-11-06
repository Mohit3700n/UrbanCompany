from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db

from app.models.vendor import Vendor, VendorService, VendorLocation
from app.models.catalog import ServiceCategory
from app.models.booking import Booking
from app.models.review import Review

from app.schemas.vendor_profile import (
    VendorPublicProfileOut,
    VendorServiceProfile,
    VendorLocationProfile,
)


router = APIRouter(
    prefix="/vendor-profiles",
    tags=["Vendor Profiles"]
)


@router.get(
    "/{vendor_id}",
    response_model=VendorPublicProfileOut
)
def get_vendor_public_profile(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    # 1. Find approved and active vendor
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.status == "approved",
        Vendor.is_active.is_(True),
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found or unavailable"
        )

    # 2. Get vendor services and categories
    service_results = (
        db.query(VendorService, ServiceCategory)
        .join(
            ServiceCategory,
            VendorService.category_id == ServiceCategory.id
        )
        .filter(
            VendorService.vendor_id == vendor.id,
            ServiceCategory.is_active.is_(True)
        )
        .all()
    )

    services = [
        VendorServiceProfile(
            category_id=category.id,
            category_name=category.name,
            category_slug=category.slug,
            skill_description=vendor_service.skill_description,
        )
        for vendor_service, category in service_results
    ]

    # 3. Get vendor location
    location_record = db.query(VendorLocation).filter(
        VendorLocation.vendor_id == vendor.id
    ).first()

    location = None

    if location_record:
        location = VendorLocationProfile(
            latitude=location_record.latitude,
            longitude=location_record.longitude,
            address_label=location_record.address_label,
        )

    # 4. Calculate average rating and review count
    rating_result = db.query(
        func.avg(Review.rating),
        func.count(Review.id)
    ).filter(
        Review.vendor_id == vendor.id
    ).first()

    average_rating, total_reviews = rating_result

    # 5. Count completed bookings
    completed_jobs = db.query(
        func.count(Booking.id)
    ).filter(
        Booking.vendor_id == vendor.id,
        Booking.status == "completed"
    ).scalar()

    # 6. Return complete vendor profile
    return VendorPublicProfileOut(
        vendor_id=vendor.id,
        business_name=vendor.business_name,
        description=vendor.description,
        phone=vendor.phone,
        accepting_requests=vendor.accepting_requests,
        location=location,
        services=services,
        average_rating=round(float(average_rating or 0), 2),
        total_reviews=total_reviews,
        completed_jobs=completed_jobs or 0,
    )