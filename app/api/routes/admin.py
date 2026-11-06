
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import require_role

from app.models.vendor import Vendor, VendorLocation, VendorService
from app.models.user import User
from app.models.catalog import ServiceCategory


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


@router.get("/vendors/pending")
def get_pending_vendors(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    vendors = (
        db.query(Vendor)
        .filter(Vendor.status == "pending")
        .order_by(Vendor.id.desc())
        .all()
    )

    applications = []

    for vendor in vendors:
        owner = db.query(User).filter(
            User.id == vendor.user_id
        ).first()

        location = db.query(VendorLocation).filter(
            VendorLocation.vendor_id == vendor.id
        ).first()

        services = (
            db.query(ServiceCategory)
            .join(
                VendorService,
                VendorService.category_id == ServiceCategory.id
            )
            .filter(VendorService.vendor_id == vendor.id)
            .all()
        )

        applications.append({
            "vendor_id": vendor.id,
            "business_name": vendor.business_name,
            "description": vendor.description,
            "phone": vendor.phone,
            "status": vendor.status,
            "owner_name": owner.full_name if owner else None,
            "owner_email": owner.email if owner else None,
            "address_label": location.address_label if location else None,
            "latitude": location.latitude if location else None,
            "longitude": location.longitude if location else None,
            "services": [
                {
                    "id": service.id,
                    "name": service.name,
                }
                for service in services
            ],
        })

    return applications


@router.post("/vendors/{vendor_id}/approve")
def approve_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor application not found"
        )

    if vendor.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve an application with status '{vendor.status}'"
        )

    vendor.status = "approved"
    vendor.is_active = True
    vendor.accepting_requests = True

    db.commit()
    db.refresh(vendor)

    return {
        "message": "Vendor approved successfully",
        "vendor_id": vendor.id,
        "status": vendor.status,
    }


@router.post("/vendors/{vendor_id}/reject")
def reject_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor application not found"
        )

    if vendor.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject an application with status '{vendor.status}'"
        )

    vendor.status = "rejected"
    vendor.is_active = False
    vendor.accepting_requests = False

    db.commit()
    db.refresh(vendor)

    return {
        "message": "Vendor application rejected",
        "vendor_id": vendor.id,
        "status": vendor.status,
    }
