from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    id: int
    booking_id: int
    customer_id: int
    vendor_id: int
    rating: int
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VendorReviewOut(BaseModel):
    id: int
    booking_id: int
    customer_name: str
    rating: int
    comment: str | None
    created_at: datetime


class VendorRatingSummary(BaseModel):
    vendor_id: int
    average_rating: float
    total_reviews: int