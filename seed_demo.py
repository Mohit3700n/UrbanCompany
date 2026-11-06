"""
DailyDrill demo seeder.
Run from backend root: python -m scripts.seed_demo

Additive and idempotent for records carrying [DEMO-*] markers.
Does not delete existing records or modify existing users.
"""

import random
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.db import SessionLocal
from app.security import hash_password
from app.models.user import User
from app.models.catalog import ServiceCategory
from app.models.vendor import Vendor, VendorService, VendorLocation
from app.models.availability import VendorWorkingHours, VendorUnavailableDate
from app.models.service_request import ServiceRequest
from app.models.booking import Booking
from app.models.review import Review

IST = ZoneInfo("Asia/Kolkata")
PASSWORD = "DailyDrill@123"
ADMIN_EMAIL = "demo.admin@dailydrill.test"

CATEGORY_DATA = [
    ("Electrician", "electrician", "Electrical installation, wiring and repairs."),
    ("Plumber", "plumber", "Pipe, tap, drainage and bathroom services."),
    ("Carpenter", "carpenter", "Furniture repair, fitting and woodwork."),
    ("Painter", "painter", "Interior and exterior painting."),
    ("Maid/Housekeeping", "maid-housekeeping", "Home cleaning and housekeeping."),
    ("Cook", "cook", "Daily cooking and meal preparation."),
    ("Appliance Repair", "appliance-repair", "Household appliance repair."),
]

CUSTOMERS = [
    "Aarav Sharma", "Ananya Patil", "Rohan More", "Sneha Joshi", "Aditya Naik",
    "Pooja Singh", "Sahil Shah", "Neha Yadav", "Omkar Pawar", "Isha Gupta",
    "Kunal Jadhav", "Priya Mishra", "Akash Tiwari", "Riya Deshmukh", "Harsh Mehta",
    "Sakshi Kulkarni", "Rahul Verma", "Tanvi Sawant", "Vivek Patil", "Aditi Nair",
    "Nikhil Shinde", "Kavya Shah", "Saurabh More", "Mansi Gupta", "Yash Thakur",
    "Diya Joshi", "Abhishek Pawar", "Simran Kaur", "Manav Jain", "Gauri Naik",
]

VENDORS = [
    ("A1 Electrical Services", "Electrician", "Palghar East", 19.6960, 72.7720),
    ("Shree Ganesh Plumbing", "Plumber", "Palghar West", 19.6930, 72.7580),
    ("Om Sai Furniture Works", "Carpenter", "Boisar", 19.8010, 72.7550),
    ("ColorCraft Painting", "Painter", "Mahim Road", 19.7050, 72.7900),
    ("CleanNest Housekeeping", "Maid/Housekeeping", "Palghar", 19.6900, 72.7660),
    ("Maa Kitchen Services", "Cook", "Saphale", 19.5780, 72.8250),
    ("QuickFix Appliance Care", "Appliance Repair", "Palghar East", 19.7010, 72.7800),
    ("BrightSpark Electricals", "Electrician", "Boisar East", 19.8030, 72.7700),
    ("Sai Krupa Plumbing", "Plumber", "Manor", 19.8560, 72.8530),
    ("WoodLine Carpentry", "Carpenter", "Palghar West", 19.6870, 72.7510),
    ("Perfect Coat Painters", "Painter", "Boisar", 19.7950, 72.7480),
    ("HomeShine Cleaning", "Maid/Housekeeping", "Palghar", 19.6990, 72.7600),
    ("DailyMeal Cook Services", "Cook", "Palghar East", 19.7100, 72.7850),
    ("Appliance Doctor", "Appliance Repair", "Saphale", 19.5900, 72.8150),
    ("PowerPoint Electrical", "Electrician", "Kelva Road", 19.6120, 72.7800),
    ("AquaCare Plumbing", "Plumber", "Tarapur", 19.8500, 72.6800),
    ("Classic Wood Works", "Carpenter", "Palghar", 19.7040, 72.7500),
    ("Royal Touch Painting", "Painter", "Palghar East", 19.7150, 72.7950),
    ("FreshStart Cleaning", "Maid/Housekeeping", "Boisar", 19.8100, 72.7600),
    ("SmartHome Appliance Repair", "Appliance Repair", "Palghar West", 19.6800, 72.7450),
]

SKILLS = {
    "Electrician": "House wiring, switchboard repair, fan installation, MCB and lighting work",
    "Plumber": "Plumbing work, pipe leakage repair, tap repair, bathroom fitting, drainage and water tank installation",
    "Carpenter": "Furniture repair, door fitting, wardrobe installation, hinge and modular furniture work",
    "Painter": "Interior painting, exterior painting, wall putty, texture painting and repainting",
    "Maid/Housekeeping": "Home deep cleaning, kitchen cleaning, bathroom cleaning and regular housekeeping",
    "Cook": "Daily home cooking, vegetarian meals, breakfast, lunch and dinner preparation",
    "Appliance Repair": "Washing machine, refrigerator, microwave, mixer and air conditioner repair",
}

PROBLEMS = [
    ("Electrician", "Switchboard is sparking and needs inspection.", "high"),
    ("Plumber", "Water is leaking below the kitchen sink.", "high"),
    ("Carpenter", "Bedroom cupboard door hinge is broken.", "normal"),
    ("Painter", "Need one bedroom repainted.", "normal"),
    ("Maid/Housekeeping", "Need deep cleaning for a 2BHK flat.", "normal"),
    ("Cook", "Need a cook for daily lunch preparation.", "normal"),
    ("Appliance Repair", "Washing machine is not draining water.", "high"),
    ("Plumber", "Bathroom tap is leaking continuously.", "normal"),
    ("Electrician", "Ceiling fan is making noise.", "normal"),
    ("Carpenter", "Need a wall-mounted shelf installed.", "low"),
]

ADDRESSES = [
    "Near Palghar Railway Station, Palghar, Maharashtra",
    "Mahim Road, Palghar, Maharashtra",
    "Boisar East, Palghar, Maharashtra",
    "Palghar West, Palghar, Maharashtra",
    "Manor Road, Palghar, Maharashtra",
    "Saphale, Palghar, Maharashtra",
    "Kelva Road, Palghar, Maharashtra",
    "Tarapur Road, Palghar, Maharashtra",
]

COMMENTS = [
    "Arrived on time and completed the work properly.",
    "Good communication and professional service.",
    "Work was completed neatly. Would book again.",
    "Polite behaviour and a good overall experience.",
    "The issue was diagnosed quickly and fixed.",
    "Service was good, but arrival was slightly delayed.",
    "Very helpful and explained the repair clearly.",
    "Clean work and no unnecessary charges.",
    "Satisfied with the overall service.",
    "Good quality work for the quoted job.",
]


def get_or_create_user(db, email, name, role):
    user = db.query(User).filter(User.email == email).one_or_none()
    if user:
        return user, False
    user = User(
        full_name=name,
        email=email,
        password_hash=hash_password(PASSWORD),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user, True


def main():
    random.seed(20261106)
    db = SessionLocal()
    counts = {k: 0 for k in [
        "categories", "users", "vendors", "vendor_services", "locations",
        "working_hours", "unavailable_dates", "service_requests", "bookings", "reviews"
    ]}

    try:
        # Categories
        category_map = {}
        for name, slug, description in CATEGORY_DATA:
            obj = db.query(ServiceCategory).filter(
                (ServiceCategory.slug == slug) | (ServiceCategory.name == name)
            ).one_or_none()
            if obj is None:
                obj = ServiceCategory(
                    name=name, slug=slug, description=description, is_active=True
                )
                db.add(obj)
                db.flush()
                counts["categories"] += 1
            elif not obj.is_active:
                obj.is_active = True
            category_map[name] = obj

        # Admin: create only if absent; never change an existing account.
        admin, created = get_or_create_user(
            db, ADMIN_EMAIL, "DailyDrill Demo Admin", "admin"
        )
        counts["users"] += int(created)
        if not created and admin.role != "admin":
            print(f"WARNING: {ADMIN_EMAIL} exists with role={admin.role!r}; not modified.")

        # Customers
        customers = []
        for i, name in enumerate(CUSTOMERS, 1):
            user, created = get_or_create_user(
                db, f"demo.customer{i:02d}@dailydrill.test", name, "customer"
            )
            if user.role != "customer":
                raise RuntimeError(f"Demo customer email has unexpected role: {user.email}")
            customers.append(user)
            counts["users"] += int(created)

        # Vendor accounts, profiles, services, locations and availability
        vendors = []
        secondary = {
            "Electrician": "Appliance Repair", "Plumber": "Electrician",
            "Carpenter": "Painter", "Painter": "Carpenter",
            "Maid/Housekeeping": "Cook", "Cook": "Maid/Housekeeping",
            "Appliance Repair": "Electrician",
        }
        for i, (business, primary_name, area, lat, lon) in enumerate(VENDORS, 1):
            owner, created = get_or_create_user(
                db, f"demo.vendor{i:02d}@dailydrill.test", f"Owner {i:02d}", "vendor"
            )
            counts["users"] += int(created)
            if owner.role != "vendor":
                raise RuntimeError(f"Demo vendor email has unexpected role: {owner.email}")

            vendor = db.query(Vendor).filter(Vendor.user_id == owner.id).one_or_none()
            if vendor is None:
                if i <= 15:
                    status, active, accepting = "approved", True, True
                elif i <= 18:
                    status, active, accepting = "pending", False, False
                else:
                    status, active, accepting = "rejected", False, False
                vendor = Vendor(
                    user_id=owner.id,
                    business_name=business,
                    description=f"{business} provides {primary_name.lower()} services around {area}, Palghar.",
                    phone=f"900000{i:04d}",
                    status=status,
                    is_active=active,
                    accepting_requests=accepting,
                )
                db.add(vendor)
                db.flush()
                counts["vendors"] += 1
            vendors.append(vendor)

            for cat_name in (primary_name, secondary[primary_name]):
                cat = category_map[cat_name]
                exists = db.query(VendorService).filter(
                    VendorService.vendor_id == vendor.id,
                    VendorService.category_id == cat.id,
                ).one_or_none()
                if exists is None:
                    db.add(VendorService(
                        vendor_id=vendor.id,
                        category_id=cat.id,
                        skill_description=SKILLS[cat_name][:250],
                    ))
                    counts["vendor_services"] += 1

            loc = db.query(VendorLocation).filter(
                VendorLocation.vendor_id == vendor.id
            ).one_or_none()
            if loc is None:
                db.add(VendorLocation(
                    vendor_id=vendor.id,
                    latitude=lat,
                    longitude=lon,
                    address_label=f"{area}, Palghar, Maharashtra",
                ))
                counts["locations"] += 1

            for weekday in range(7):
                hours = db.query(VendorWorkingHours).filter(
                    VendorWorkingHours.vendor_id == vendor.id,
                    VendorWorkingHours.day_of_week == weekday,
                ).one_or_none()
                if hours is None:
                    db.add(VendorWorkingHours(
                        vendor_id=vendor.id,
                        day_of_week=weekday,
                        start_time=time(9, 0),
                        end_time=time(19, 0),
                        is_available=(weekday != 6),
                    ))
                    counts["working_hours"] += 1

            unavailable_date = date.today() + timedelta(days=14 + i % 7)
            unavailable = db.query(VendorUnavailableDate).filter(
                VendorUnavailableDate.vendor_id == vendor.id,
                VendorUnavailableDate.unavailable_date == unavailable_date,
            ).one_or_none()
            if unavailable is None:
                db.add(VendorUnavailableDate(
                    vendor_id=vendor.id,
                    unavailable_date=unavailable_date,
                    reason="Demo: personal work",
                ))
                counts["unavailable_dates"] += 1

        db.flush()

        # Service requests
        today = date.today()
        for i in range(1, 31):
            customer = customers[(i - 1) % len(customers)]
            category_name, problem, urgency = PROBLEMS[(i - 1) % len(PROBLEMS)]
            description = f"[DEMO-REQ-{i:03d}] {problem}"
            existing = db.query(ServiceRequest).filter(
                ServiceRequest.customer_id == customer.id,
                ServiceRequest.problem_description == description,
            ).one_or_none()
            if existing is None:
                db.add(ServiceRequest(
                    customer_id=customer.id,
                    category_id=category_map[category_name].id,
                    problem_description=description,
                    location=ADDRESSES[(i - 1) % len(ADDRESSES)],
                    preferred_date=(today + timedelta(days=i % 10)).isoformat(),
                    preferred_time=["Morning", "Afternoon", "Evening"][i % 3],
                    urgency=urgency,
                    status=["open", "open", "matched", "cancelled"][i % 4],
                ))
                counts["service_requests"] += 1

        db.flush()

        # Bookings: 25 completed, 8 pending, 7 accepted, 3 in progress,
        # 4 cancelled and 3 rejected. Demo records are marked in description.
        statuses = (
            ["completed"] * 25 + ["pending"] * 8 + ["accepted"] * 7
            + ["in_progress"] * 3 + ["cancelled"] * 4 + ["rejected"] * 3
        )
        random.Random(20261106).shuffle(statuses)
        now = datetime.now(IST)
        completed = []

        for i, status in enumerate(statuses, 1):
            customer = customers[(i * 3 - 1) % len(customers)]
            vendor = vendors[(i * 7 - 1) % 15]  # approved vendor pool
            _, problem, _ = PROBLEMS[(i - 1) % len(PROBLEMS)]
            description = f"[DEMO-BOOKING-{i:03d}] {problem}"

            booking = db.query(Booking).filter(
                Booking.customer_id == customer.id,
                Booking.problem_description == description,
            ).one_or_none()

            if booking is None:
                if status == "completed":
                    start = now - timedelta(days=i, hours=2)
                elif status == "in_progress":
                    start = now - timedelta(minutes=30)
                elif status in ("cancelled", "rejected"):
                    start = now - timedelta(days=2 + i % 5, hours=2)
                else:
                    start = now + timedelta(days=1 + i % 14, hours=1)

                booking = Booking(
                    customer_id=customer.id,
                    vendor_id=vendor.id,
                    service_request_id=None,
                    problem_description=description,
                    start_at=start,
                    end_at=start + timedelta(hours=1),
                    status=status,
                    arrival_otp_verified=status in ("in_progress", "completed"),
                    completion_otp_verified=(status == "completed"),
                )
                db.add(booking)
                db.flush()
                counts["bookings"] += 1

            if booking.status == "completed":
                completed.append(booking)

        # Reviews: only completed bookings; unique booking_id is respected.
        for i, booking in enumerate(completed[:25], 1):
            exists = db.query(Review).filter(Review.booking_id == booking.id).one_or_none()
            if exists is None:
                db.add(Review(
                    booking_id=booking.id,
                    customer_id=booking.customer_id,
                    vendor_id=booking.vendor_id,
                    rating=[5, 4, 5, 4, 3][(i - 1) % 5],
                    comment=COMMENTS[(i - 1) % len(COMMENTS)],
                ))
                counts["reviews"] += 1

        db.commit()
        print("\nDailyDrill demo seeding completed:")
        for key, value in counts.items():
            print(f"  {key}: {value}")
        print("\nDemo login credentials (for newly created accounts):")
        print(f"  Admin:    {ADMIN_EMAIL}")
        print("  Customer: demo.customer01@dailydrill.test")
        print("  Vendor:   demo.vendor01@dailydrill.test")
        print(f"  Password: {PASSWORD}")
        print("Existing accounts are never password-reset by this script.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
