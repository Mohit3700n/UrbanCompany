from datetime import datetime, timezone

from pydantic import BaseModel, Field, model_validator


class BookingCreate(BaseModel):
    vendor_id: int = Field(gt=0)
    service_request_id: int | None = Field(default=None, gt=0)
    problem_description: str = Field(min_length=5, max_length=2000)
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def validate_booking_time(self):
        if self.start_at.tzinfo is None or self.end_at.tzinfo is None:
            raise ValueError("Booking times must include a timezone")

        if self.end_at <= self.start_at:
            raise ValueError("End time must be after start time")

        if self.start_at <= datetime.now(timezone.utc):
            raise ValueError("Booking must be scheduled in the future")

        return self


class BookingOut(BaseModel):
    id: int
    customer_id: int
    vendor_id: int
    service_request_id: int | None = None
    problem_description: str
    start_at: datetime
    end_at: datetime
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerBookingHistoryOut(BaseModel):
    id: int
    vendor_id: int
    service_request_id: int | None = None
    vendor_business_name: str
    problem_description: str
    start_at: datetime
    end_at: datetime
    status: str
    created_at: datetime


class VendorBookingRequestOut(BaseModel):
    id: int
    customer_id: int
    service_request_id: int | None = None
    customer_name: str
    problem_description: str
    start_at: datetime
    end_at: datetime
    status: str
    created_at: datetime
    
class OTPVerify(BaseModel):
    otp: str = Field(pattern=r"^\d{6}$")