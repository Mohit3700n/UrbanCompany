from pydantic import BaseModel


class VendorServiceProfile(BaseModel):
    category_id: int
    category_name: str
    category_slug: str
    skill_description: str | None = None


class VendorLocationProfile(BaseModel):
    latitude: float
    longitude: float
    address_label: str


class VendorPublicProfileOut(BaseModel):
    vendor_id: int
    business_name: str
    description: str | None
    phone: str | None

    accepting_requests: bool

    location: VendorLocationProfile | None

    services: list[VendorServiceProfile]

    average_rating: float
    total_reviews: int
    completed_jobs: int