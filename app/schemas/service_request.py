from datetime import datetime

from pydantic import BaseModel, Field


class ServiceRequestCreate(BaseModel):
    category_id: int | None = Field(default=None, gt=0)
    problem_description: str = Field(min_length=5, max_length=2000)
    location: str = Field(min_length=2, max_length=300)
    preferred_date: str | None = None
    preferred_time: str | None = None
    urgency: str = "normal"


class ServiceRequestOut(BaseModel):
    id: int
    customer_id: int
    category_id: int | None
    problem_description: str
    location: str
    preferred_date: str | None
    preferred_time: str | None
    urgency: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}