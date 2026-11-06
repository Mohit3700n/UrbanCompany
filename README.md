# DailyDrill Phase 1 — Marketplace Foundation

This is the first backend milestone: authentication, service catalogue, vendor onboarding,
admin approval and PostGIS-based nearby vendor search. The AI agent, booking engine,
payments and B2B RFQ workflows are intentionally not included yet.

## Requirements
- Python 3.11+
- Docker Desktop
- Git (recommended)

## 1. Configure
```bash
# Windows PowerShell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1

# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Edit `.env`. Replace `JWT_SECRET` with a long random secret.

## 2. Start database
```bash
docker compose up -d
```

Wait until the PostGIS container is healthy.

## 3. Start API
```bash
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs and http://127.0.0.1:8000/health.

## 4. Seed categories and local admin
In another terminal, activate the virtual environment:
```bash
python -m scripts.seed
```

Development admin credentials:
- Email: `admin@dailydrill.local`
- Password: `ChangeMe123!`

Change this password and remove the bootstrap account before any shared or production deployment.

## 5. Test the workflow in Swagger

### A. Register a customer/vendor account
`POST /api/v1/auth/register`
```json
{
  "full_name": "Test Electrician",
  "email": "electrician@example.com",
  "password": "TestPass123"
}
```

### B. Log in
Use `POST /api/v1/auth/login`. OAuth2 form fields:
- username = email
- password = password

Copy `access_token`, click **Authorize**, and enter the token.

### C. List categories
`GET /api/v1/services/categories`. Note the electrician category ID.

### D. Create vendor profile
`POST /api/v1/vendors/profile`
```json
{
  "business_name": "Test Electrical Services",
  "description": "Home electrical repairs",
  "phone": "9000000001",
  "latitude": 19.6967,
  "longitude": 72.7699,
  "address_label": "Test address, Maharashtra",
  "category_ids": [1]
}
```
The profile starts as `pending` and must not appear in public search.

### E. Approve vendor
Log in as the seeded admin using the admin credentials, authorize with its token,
then call `GET /api/v1/admin/vendors/pending` and
`POST /api/v1/admin/vendors/{vendor_id}/approve`.

### F. Search vendors
`GET /api/v1/vendors/search` with:
- `category_id`: electrician category ID
- `latitude`: 19.6967
- `longitude`: 72.7699
- `radius_km`: 3

The approved vendor should appear if its saved coordinates are within 3 km.

## API endpoints in this milestone
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/services/categories`
- `POST /api/v1/vendors/profile`
- `GET /api/v1/vendors/me`
- `GET /api/v1/vendors/search`
- `GET /api/v1/admin/vendors/pending`
- `POST /api/v1/admin/vendors/{id}/approve`
- `POST /api/v1/admin/vendors/{id}/reject`

## Important MVP limitations
- Vendor registration is a simple profile workflow, not identity verification.
- The seeded admin is development-only.
- Search checks approved/active/accepting vendors and category + radius only.
- Availability calendar, service-area polygons, ratings, pricing, booking and OTP are later milestones.
- Search radius is supplied by the caller in this phase. The automatic expansion policy is added in Phase 2.
- `create_all` is for local bootstrap. Introduce Alembic migrations before team/shared deployments.
- Add rate limiting, email/phone verification, password reset, audit logging, stronger validation,
  secrets management and production security before public launch.

## Next milestone
Build a web interface (customer search + vendor onboarding + admin approval) against these APIs,
then add the AI agent and bounded radius-expansion orchestration.
