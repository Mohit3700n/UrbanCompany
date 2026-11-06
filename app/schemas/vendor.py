from pydantic import BaseModel, Field

class VendorCreate(BaseModel):
    business_name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    phone: str | None = Field(default=None, max_length=20)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address_label: str = Field(min_length=3, max_length=300)
    category_ids: list[int] = Field(min_length=1)

class VendorOut(BaseModel):
    id: int
    business_name: str
    description: str | None
    phone: str | None
    status: str
    accepting_requests: bool
    model_config = {"from_attributes": True}

class VendorSearchItem(BaseModel):
    vendor_id: int
    business_name: str
    description: str | None
    distance_km: float
    address_label: str
    accepting_requests: bool
    category_id: int

class VendorProfileOut(BaseModel):
    vendor_id: int
    business_name: str
    description: str | None
    status: str
    accepting_requests: bool

    address_label: str
    latitude: float
    longitude: float

    categories: list[str]

    model_config = {"from_attributes": True}