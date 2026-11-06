from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.catalog import ServiceCategory
from app.models.user import User
from app.security import hash_password

CATEGORIES = [
    ("Electrician", "electrician", "Electrical repair, wiring and installation"),
    ("Plumber", "plumber", "Water supply, pipes, taps and drainage"),
    ("Carpenter", "carpenter", "Furniture, doors and woodwork"),
    ("Painter", "painter", "Interior and exterior painting"),
    ("Maid / Housekeeping", "maid-housekeeping", "Home cleaning and housekeeping"),
    ("Cook", "cook", "Home cooking and meal preparation"),
    ("Appliance Repair", "appliance-repair", "Repair of household appliances"),
]

def main():
    db: Session = SessionLocal()
    try:
        for name, slug, description in CATEGORIES:
            if not db.query(ServiceCategory).filter_by(slug=slug).first():
                db.add(ServiceCategory(name=name, slug=slug, description=description))
        # Local development bootstrap only. Change password immediately.
        if not db.query(User).filter_by(email="admin@dailydrill.local").first():
            db.add(User(full_name="DailyDrill Admin", email="admin@dailydrill.local",
                        password_hash=hash_password("ChangeMe123!"), role="admin"))
        db.commit()
        print("Seed completed. Admin: admin@dailydrill.local / ChangeMe123!")
    finally:
        db.close()

if __name__ == "__main__":
    main()
