from datetime import date, time

from pydantic import BaseModel, Field, model_validator


class WorkingHoursInput(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    is_available: bool = True

    @model_validator(mode="after")
    def validate_times(self):
        if self.is_available and self.start_time >= self.end_time:
            raise ValueError("End time must be later than start time")
        return self


class WorkingHoursBulkInput(BaseModel):
    working_hours: list[WorkingHoursInput]


class UnavailableDateInput(BaseModel):
    unavailable_date: date
    reason: str | None = Field(default=None, max_length=250)


class BatchAvailabilityInput(BaseModel):
    vendor_ids: list[int] = Field(min_length=1, max_length=20)
    requested_date: date
    duration_minutes: int = Field(default=60, ge=15, le=480)
    slot_interval_minutes: int = Field(default=30, ge=15, le=120)