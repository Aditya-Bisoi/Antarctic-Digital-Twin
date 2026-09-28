# Antarctic Digital Twin — Django REST Backend

Python Django REST Framework backend service for the **Antarctic Digital Twin** platform, providing real-time telemetry, station dashboards, subsystem health tracking, rule-based AI insights, and interactive What-If environmental stress simulations for **Maitri Station** and **Bharati Station**.

---

## Tech Stack
- **Language**: Python 3.13+
- **Framework**: Django 5.1 & Django REST Framework (DRF)
- **Database**: SQLite (`db.sqlite3` for dev)
- **Authentication**: JWT (`djangorestframework-simplejwt`)
- **CORS**: `django-cors-headers`

---

## Directory Structure

```text
backend/
├── config/
│   ├── settings.py         # Django settings (CORS, REST Framework, SimpleJWT)
│   ├── urls.py             # Main API URL router
│   └── wsgi.py             # WSGI application entrypoint
├── stations/
│   ├── admin.py            # Django Admin registration for all models
│   ├── models.py           # Station, Energy, Environment, Infrastructure, Logistics, Alert, DigitalTwinModule models
│   ├── serializers.py      # DRF serializers for API payloads
│   ├── services.py         # AI Insights engine & What-If simulation logic
│   ├── views.py            # API endpoint viewhandlers
│   ├── urls.py             # Station API endpoint routes
│   └── management/
│       └── commands/
│           └── seed_data.py # Data seeder command
├── .env.example            # Environment variables template
├── manage.py               # Django CLI utility
└── requirements.txt        # Python package dependencies
```

---

## Quickstart & Installation

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Environment Variables Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 4. Seed Telemetry Database
Populate database with complete realistic sample telemetry for Maitri and Bharati:
```bash
python manage.py seed_data
```

### 5. Create Superuser (Admin Access)
```bash
python manage.py createsuperuser
```

### 6. Run Backend Server
```bash
python manage.py runserver 0.0.0.0:8000
```
The API server will run at: `http://localhost:8000/api/`
Django Admin Panel will be accessible at: `http://localhost:8000/admin/`

---

## API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/stations/` | List all research stations |
| `GET` | `/api/stations/{id}/` | Get single station detail |
| `GET` | `/api/stations/{id}/dashboard/` | Full dashboard payload (Telemetry, AI insights, Subsystems, Alerts, Twin Modules) |
| `GET` | `/api/stations/{id}/energy/` | Current energy statistics |
| `GET` | `/api/stations/{id}/energy/history/` | Historical time-series energy metrics |
| `GET` | `/api/stations/{id}/environment/` | Current weather and environmental data |
| `GET` | `/api/stations/{id}/environment/history/` | Historical time-series weather metrics |
| `GET` | `/api/stations/{id}/alerts/` | Operational station advisories |
| `POST` | `/api/stations/{id}/simulate/` | Execute non-mutating What-If environmental simulation |
| `POST` | `/api/token/` | Obtain JWT access & refresh token pair |
| `POST` | `/api/token/refresh/` | Refresh expired JWT token |

---

## What-If Simulation Scenarios
`POST /api/stations/{id}/simulate/` supports payload:
```json
{
  "scenario": "Generator Failure"
}
```
Available Scenarios:
1. `Generator Failure`
2. `Power Failure`
3. `Extreme Weather`
4. `Fuel Shortage`

Returns battery impact rate, backup duration, risk level, and recommended mitigation actions without mutating live station data.
