from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.catalog import ServiceCategory
from app.schemas.catalog import CategoryOut

router = APIRouter(prefix="/services", tags=["Service catalogue"])

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(ServiceCategory).filter(ServiceCategory.is_active == True).order_by(ServiceCategory.name).all()
