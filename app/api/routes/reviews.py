from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import get_current_user, require_role

from app.models.user import User
from app.models.booking import Booking
from app.models.review import Review
from app.schemas.review import ReviewOut
from app.models.vendor import Vendor

from app.schemas.review import (
    ReviewCreate,
    ReviewOut,
    VendorReviewOut,
    VendorRatingSummary,
)


router = APIRouter(prefix="/reviews", tags=["Reviews"])


# --------------------------------------------------
# 1. CUSTOMER SUBMITS A REVIEW
# --------------------------------------------------

@router.post(
    "/booking/{booking_id}",
    response_model=ReviewOut,
    status_code=201
)
def create_review(
    booking_id: int,
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    booking = db.query(Booking).filter(
        Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if booking.customer_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot review someone else's booking"
        )

    if booking.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="You can only review completed bookings"
        )

    existing_review = db.query(Review).filter(
        Review.booking_id == booking.id
    ).first()

    if existing_review:
        raise HTTPException(
            status_code=409,
            detail="You have already reviewed this booking"
        )

    review = Review(
        booking_id=booking.id,
        customer_id=user.id,
        vendor_id=booking.vendor_id,
        rating=payload.rating,
        comment=payload.comment,
    )

    try:
        db.add(review)
        db.commit()
        db.refresh(review)
        return review

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A review already exists for this booking"
        )


# --------------------------------------------------
# 2. GET REVIEWS FOR A VENDOR
# --------------------------------------------------

@router.get(
    "/vendor/{vendor_id}",
    response_model=list[VendorReviewOut]
)
def get_vendor_reviews(
    vendor_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    results = (
        db.query(Review, User.full_name)
        .join(User, Review.customer_id == User.id)
        .filter(Review.vendor_id == vendor_id)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": review.id,
            "booking_id": review.booking_id,
            "customer_name": customer_name,
            "rating": review.rating,
            "comment": review.comment,
            "created_at": review.created_at,
        }
        for review, customer_name in results
    ]


# --------------------------------------------------
# 3. GET VENDOR AVERAGE RATING
# --------------------------------------------------

@router.get(
    "/vendor/{vendor_id}/summary",
    response_model=VendorRatingSummary
)
def get_vendor_rating_summary(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    result = db.query(
        func.avg(Review.rating),
        func.count(Review.id)
    ).filter(
        Review.vendor_id == vendor_id
    ).first()

    average_rating, total_reviews = result

    return {
        "vendor_id": vendor_id,
        "average_rating": round(float(average_rating or 0), 2),
        "total_reviews": total_reviews,
    }


# --------------------------------------------------
# 4. CUSTOMER VIEW THEIR OWN REVIEWS
# --------------------------------------------------

@router.get(
    "/my",
    response_model=list[ReviewOut]
)
def get_my_reviews(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    return (
        db.query(Review)
        .filter(Review.customer_id == user.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    
    

@router.get("/booking/{booking_id}", response_model=ReviewOut | None)
def get_booking_review(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = (
        db.query(Booking)
        .filter(
            Booking.id == booking_id,
            Booking.customer_id == user.id
        )
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    review = (
        db.query(Review)
        .filter(Review.booking_id == booking_id)
        .first()
    )

    return review