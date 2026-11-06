from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import require_role

from app.models.user import User
from app.models.catalog import ServiceCategory
from app.models.service_request import ServiceRequest
from app.models.booking import Booking

from app.schemas.service_request import (
    ServiceRequestCreate,
    ServiceRequestOut,
)


router = APIRouter(
    prefix="/service-requests",
    tags=["Customer Service Requests"]
)


VALID_URGENCY = {"low", "normal", "high", "emergency"}


# --------------------------------------------------
# 1. CREATE SERVICE REQUEST
# --------------------------------------------------

@router.post(
    "/",
    response_model=ServiceRequestOut,
    status_code=201
)
def create_service_request(
    payload: ServiceRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    if payload.urgency not in VALID_URGENCY:
        raise HTTPException(
            status_code=400,
            detail="Invalid urgency. Use low, normal, high or emergency."
        )

    if payload.category_id is not None:
        category = db.query(ServiceCategory).filter(
            ServiceCategory.id == payload.category_id,
            ServiceCategory.is_active.is_(True)
        ).first()

        if not category:
            raise HTTPException(
                status_code=404,
                detail="Active service category not found"
            )

    service_request = ServiceRequest(
        customer_id=user.id,
        category_id=payload.category_id,
        problem_description=payload.problem_description,
        location=payload.location,
        preferred_date=payload.preferred_date,
        preferred_time=payload.preferred_time,
        urgency=payload.urgency,
        status="open",
    )

    db.add(service_request)
    db.commit()
    db.refresh(service_request)

    return service_request


# --------------------------------------------------
# 2. CUSTOMER VIEW THEIR REQUESTS
# --------------------------------------------------

@router.get(
    "/my",
    response_model=list[ServiceRequestOut]
)
def get_my_service_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    return (
        db.query(ServiceRequest)
        .filter(ServiceRequest.customer_id == user.id)
        .order_by(ServiceRequest.created_at.desc())
        .all()
    )


# --------------------------------------------------
# 3. CUSTOMER VIEW ONE REQUEST
# --------------------------------------------------

@router.get(
    "/{request_id}",
    response_model=ServiceRequestOut
)
def get_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    service_request = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id,
        ServiceRequest.customer_id == user.id
    ).first()

    if not service_request:
        raise HTTPException(
            status_code=404,
            detail="Service request not found"
        )

    return service_request


# --------------------------------------------------
# 4. CANCEL CUSTOMER REQUEST
# --------------------------------------------------

@router.patch(
    "/{request_id}/cancel",
    response_model=ServiceRequestOut
)
def cancel_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("customer"))
):
    service_request = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id,
        ServiceRequest.customer_id == user.id
    ).first()

    if not service_request:
        raise HTTPException(
            status_code=404,
            detail="Service request not found"
        )

    if service_request.status != "open":
        raise HTTPException(
            status_code=400,
            detail="Only open requests can be cancelled"
        )

    service_request.status = "cancelled"

    db.commit()
    db.refresh(service_request)

    return service_request