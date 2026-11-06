from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.vendor import Vendor
from app.models.user import User
from app.security import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/vendors/pending")
def pending_vendors(db: Session = Depends(get_db), admin: User = Depends(require_role("admin"))):
    vendors = db.query(Vendor).filter(Vendor.status == "pending").order_by(Vendor.id).all()
    return [{"id": v.id, "business_name": v.business_name, "description": v.description, "phone": v.phone} for v in vendors]

@router.post("/vendors/{vendor_id}/approve")
def approve_vendor(vendor_id: int, db: Session = Depends(get_db), admin: User = Depends(require_role("admin"))):
    vendor = db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    if vendor.status != "pending":
        raise HTTPException(409, f"Vendor is not pending (current status: {vendor.status})")
    vendor.status = "approved"
    db.commit()
    return {"message": "Vendor approved", "vendor_id": vendor.id, "status": vendor.status}

@router.post("/vendors/{vendor_id}/reject")
def reject_vendor(vendor_id: int, db: Session = Depends(get_db), admin: User = Depends(require_role("admin"))):
    vendor = db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    vendor.status = "rejected"
    db.commit()
    return {"message": "Vendor rejected", "vendor_id": vendor.id, "status": vendor.status}
