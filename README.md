# ML-Forge

Lightweight ML training and benchmarking workshop application with a React + Vite frontend and a FastAPI backend. It provides an interface and HTTP API to upload datasets, train a selection of classic ML models (classification or regression), and return basic evaluation metrics. Intended for demos, teaching, or local experimentation — not production-ready.

## Stack
- Language(s): JavaScript (frontend), Python (backend)
- Framework / runtime:
  - Frontend: React + Vite
  - Backend: FastAPI + Uvicorn
- Notable libraries:
  - Frontend: Vite, React
  - Backend: scikit-learn, pandas, python-dotenv, fastapi
  - (Backend also uses a persistent users collection — see backend/db.py)

## What it does
- Lets users upload tabular datasets (CSV/JSON/XLSX).
- Trains one or more selected models (classification or regression) on the dataset.
- Returns evaluation metrics for each trained model.
- Provides simple authentication endpoints (signup/login) and per-user profile endpoints.

## Repository layout
```
backend/                 FastAPI app and Python ML utilities
  ├─ main.py             API routes: /models, /train, auth, /me
  ├─ model_registry.py   Model constructors, registry and metrics calculation
  ├─ db.py               Database connection / users_collection (used by auth)
  ├─ security.py         Auth helpers, token generation, user schemas
  └─ requirement.txt     Python dependencies

frontend/                React + Vite single-page app
  ├─ package.json
  ├─ vite.config.js
  ├─ index.html
  └─ src/
      ├─ main.jsx
      ├─ App.jsx
      ├─ index.css
      ├─ api/api.js
      └─ components/      UI pages and components (LandingPage, HomePage, DataAnalyzer, CreateData, CompareModel, etc.)
```

How it fits together:
- The frontend provides a UI to sign up / log in, upload datasets, select models and task type, then call the backend `/train` endpoint.
- The backend handles dataset parsing, preprocessing (one-hot encoding + optional scaling), model construction via model_registry.py, training (train/test split), and metric computation.

## Models available
(The backend model registry exposes these names via `/models`.)
- Linear Regression
- Logistic Regression
- Decision Tree
- Random Forest
- Support Vector Machine
- K-Nearest Neighbors
- AdaBoost
- Gradient Boosting

Each model entry indicates if it supports classification, regression, or both, and whether input scaling is required.

## Supported dataset formats
- CSV (default)
- JSON (file with array of objects)
- XLSX

The API expects a tabular dataset with a column chosen as the target column. Non-numeric features are one-hot encoded; numeric NaNs are filled with medians.

## Quick start — backend
1. Create and activate a Python environment.
2. Install dependencies:
```bash
cd backend
pip install -r requirement.txt
```
3. Configure environment variables as needed. The backend reads:
- Database/connection settings are read in `backend/db.py` — ensure a running DB if you want auth to persist.

4. Run the API:
```bash
# Option A: run the module that starts Uvicorn (main.py includes an if __main__ block)
python main.py

# Option B: run Uvicorn directly from the repo root
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The API server defaults to listening on port 8000.

## Quick start — frontend
1. Install dependencies and start dev server:
```bash
cd frontend
npm install
npm run dev
```
2. Open the local dev URL shown by Vite (typically http://localhost:5173).

The frontend is configured to talk to `http://localhost:8000` (see CORS settings in backend/main.py).

## Important API endpoints & examples

- List available models
  - GET /models

- Train models
  - POST /train
  - Form fields:
    - file: file upload (csv/json/xlsx)
    - target_column: string
    - task_type: "classification" or "regression"
    - models: JSON array of model names (e.g. '["Logistic Regression","Random Forest"]')
  - Example curl (multipart/form-data):
```bash
curl -X POST "http://localhost:8000/train" \
  -F "file=@/path/to/dataset.csv" \
  -F 'target_column=label' \
  -F 'task_type=classification' \
  -F 'models=[\"Logistic Regression\",\"Random Forest\"]'
```

## Dataset / training notes
- Categorical features are one-hot encoded.
- Features that require scaling will be scaled using StandardScaler before training for models that need it (model_registry specifies which ones).
- For classification, the target will be factorized automatically.
- For regression, non-numeric target values are coerced to numeric and rows with invalid targets are dropped.
