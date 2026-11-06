from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.models.vendor import Vendor, VendorService, VendorLocation
from app.models.user import User
from app.models.catalog import ServiceCategory
from app.schemas.vendor import VendorCreate, VendorOut, VendorSearchItem
from app.security import get_current_user, require_role
from app.schemas.vendor import VendorProfileOut

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.post("/profile", response_model=VendorOut, status_code=201)
def create_vendor_profile(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer", "vendor")),
):
    existing = db.query(Vendor).filter(
        Vendor.user_id == user.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="A vendor profile already exists for this account",
        )

    # Validate service categories
    category_ids = set(payload.category_ids)

    if not category_ids:
        raise HTTPException(
            status_code=422,
            detail="At least one service category is required",
        )

    categories = db.query(ServiceCategory).filter(
        ServiceCategory.id.in_(category_ids),
        ServiceCategory.is_active.is_(True),
    ).all()

    if len(categories) != len(category_ids):
        raise HTTPException(
            status_code=422,
            detail="One or more category IDs are invalid or inactive",
        )

    try:
        # Create vendor profile
        vendor = Vendor(
            user_id=user.id,
            business_name=payload.business_name,
            description=payload.description,
            phone=payload.phone,
            status="pending",
        )

        db.add(vendor)
        db.flush()

        # Save vendor location
        location = VendorLocation(
            vendor_id=vendor.id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            address_label=payload.address_label,
        )

        db.add(location)

        # Save offered services
        for category_id in category_ids:
            db.add(
                VendorService(
                    vendor_id=vendor.id,
                    category_id=category_id,
                )
            )

        # Promote customer to vendor
        user.role = "vendor"

        db.commit()
        db.refresh(vendor)

        return vendor

    except Exception:
        db.rollback()
        raise


@router.get("/me", response_model=VendorOut)
def my_vendor_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(404, "Vendor profile not found")
    return vendor

@router.get("/search", response_model=list[VendorSearchItem])
def search_vendors(
    category_id: int = Query(gt=0),
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=3, gt=0, le=100),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    sql = text("""
        SELECT v.id AS vendor_id, v.business_name, v.description,
               vl.address_label, v.accepting_requests, vs.category_id,
               ROUND((ST_Distance(
                   ST_SetSRID(ST_MakePoint(vl.longitude, vl.latitude), 4326)::geography,
                   ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
               ) / 1000.0)::numeric, 2)::float AS distance_km
        FROM vendors v
        JOIN vendor_locations vl ON vl.vendor_id = v.id
        JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE v.status = 'approved'
          AND v.is_active = TRUE
          AND v.accepting_requests = TRUE
          AND vs.category_id = :category_id
          AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(vl.longitude, vl.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
              :radius_meters
          )
        ORDER BY distance_km ASC
        LIMIT :limit
    """)
    rows = db.execute(sql, {
        "category_id": category_id,
        "latitude": latitude,
        "longitude": longitude,
        "radius_meters": radius_km * 1000,
        "limit": limit,
    }).mappings().all()
    return [dict(row) for row in rows]


@router.get("/{vendor_id}", response_model=VendorProfileOut)
def get_vendor_profile(
    vendor_id: int,
    db: Session = Depends(get_db),
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.status == "approved",
        Vendor.is_active.is_(True),
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    location = db.query(VendorLocation).filter(
        VendorLocation.vendor_id == vendor.id
    ).first()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Vendor location not found",
        )

    services = (
        db.query(ServiceCategory.name)
        .join(
            VendorService,
            VendorService.category_id == ServiceCategory.id,
        )
        .filter(VendorService.vendor_id == vendor.id)
        .all()
    )

    return {
        "vendor_id": vendor.id,
        "business_name": vendor.business_name,
        "description": vendor.description,
        "status": vendor.status,
        "accepting_requests": vendor.accepting_requests,
        "address_label": location.address_label,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "categories": [service[0] for service in services],
    }
