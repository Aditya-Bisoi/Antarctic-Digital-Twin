# Antarctic Digital Twin & Intelligence

An advanced 3D Digital Twin and Predictive Intelligence platform for polar research stations (**Maitri Station** and **Bharati Station**) in Antarctica.

Built for the **Smart India Hackathon (SIH)** — Problem Statement 60.

---

## 🌟 Key Features

- **3D Digital Twin Visualization**: Interactive 3D spatial models and station infrastructure representation with live subsystem health mapping.
- **Real-Time Telemetry & Dashboards**: Monitoring power generation (solar, wind, diesel generators), environmental metrics (ambient temperature, wind speeds, blizzard conditions), life support, and logistics.
- **Predictive Simulation & Risk Modeling**: Physically-consistent storm simulations, cascading failure propagation, equipment degradation prediction with ML models, and multi-objective dynamic intervention optimization.
- **Radar & Weather Tracking**: Interactive radar display with playback controls, alert overlays, and scenario stress testing.
- **AI Decision Support**: Automated operational recommendations, contingency planning, and resilience scoring for remote station survival and mission continuity.

---

## 🏗️ Architecture

```
├── remix-antarctic-digital-twin/
│   ├── src/                    # React + Vite + TypeScript frontend
│   │   ├── components/         # 3D Twin, Dashboards, Radar, Intelligence UI
│   │   ├── simulation/         # Frontend simulation engine & physics models
│   │   └── api/                # API client connecting to Django backend
│   ├── backend/                # Python Django REST Framework backend
│   │   ├── config/             # Django settings & URL routing
│   │   ├── stations/           # Stations telemetry, models, admin & seed scripts
│   │   └── simulation/         # Storm physics, cascade, ML degradation models & tests
│   └── public/                 # Static assets, maps & bathymetric charts
```

---

## 🚀 Getting Started

### 1. Frontend Setup

```bash
cd remix-antarctic-digital-twin
npm install
npm run dev
```

The frontend will start at `http://localhost:5173`.

### 2. Backend Setup (Django REST Framework)

```bash
cd remix-antarctic-digital-twin/backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`.

---

## 🧪 Testing

Run backend tests:
```bash
cd remix-antarctic-digital-twin/backend
python manage.py test simulation
```

Run frontend tests:
```bash
cd remix-antarctic-digital-twin
npm test
```

---

## 📄 License

This project is licensed under the MIT License.
