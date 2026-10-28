# MLForge

A local ML workshop: upload a dataset, clean and analyse it, train and compare classic ML models, run Python in an in-browser notebook, and ask a local AI assistant about your results. React + Vite frontend, FastAPI backend, MongoDB for accounts and chat history, Ollama for the AI. Built for demos, teaching and local experimentation. **Not production-ready** (see [Known limitations](#known-limitations)).

<!-- Add a screenshot of the Home page and one of Compare Models + the AI panel here -->

## Features

| Page | Route | What it does |
|---|---|---|
| Model tester | `/compare` | Train several models on one dataset and rank them on held-out test data |
| Analyse data | `/analyze` | Explore columns, distributions and outliers |
| Create dataset | `/createdata` | Generate synthetic datasets for quick experiments |
| Cleanse data | `/cleandata` | Handle missing values, duplicates and bad types |
| ML Notebook | `/compiler` | Jupyter-style Python notebook that runs **in the browser** |
| Library | `/textcode` | Browse written code for practice |
| AI assistant | (panel) | Right-side chat panel, available on every signed-in page |

Other details:
- **Accounts:** signup and login with JWT. Every page except `/` and `/login` requires a token.
- **Themes:** four global themes (Green, White, Black, Navy blue), saved in `localStorage`.

### AI assistant
- Open it with the **Ask AI** button next to the theme button. It slides in from the right and takes at most 45% of the screen on desktop (full width on mobile). Esc closes it.
- Runs on **local Ollama models**: a vision model when you attach images, a coding model otherwise. Replies stream over SSE.
- Chat history is saved per user in MongoDB, with search, delete and clear-all.
- Each reply has **Copy** and **Regenerate** buttons.
- You can attach images and `.csv`, `.json`, `.txt` and `.md` files (up to 5 files, 10 MB each).

### Context AI
Some pages can share what you are looking at with the assistant:
- **Compare Models:** click **Context AI** after a run. The assistant gets the dataset name, size, task, target, scaling, every model's metrics, the best model, and the first 10 rows of a CSV, then opens with a greeting.
- **ML Notebook:** click **Context AI** in the toolbar, or **Ask AI** / **Fix with AI** on a single cell. It sends the focused cell's code, output and the end of any traceback, plus shortened versions of the other cells. Obvious secrets (API keys, tokens, passwords) are redacted before sending.
- The context is sent as a text summary (the backend keeps the first 6000 characters), not as the raw file. It is a snapshot: click again after changing results. It is not saved with the chat, and the chip above the message box removes it.

### ML Notebook
- Python runs in your browser with [Pyodide](https://pyodide.org) (v0.26.4, loaded from the jsDelivr CDN). The first load downloads about 10 MB, and an internet connection is needed for it.
- Cells share variables. Shift+Enter runs a cell, and "Run all" runs them in order. Packages are loaded from your imports.
- Upload datasets and read them by name, e.g. `pd.read_csv("data.csv")`. Matplotlib plots are captured as images. Export to `.ipynb`.

## Stack
- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** FastAPI, Uvicorn, scikit-learn, pandas, pymongo
- **Database:** MongoDB (users and chats)
- **AI:** [Ollama](https://ollama.com) running locally (`http://localhost:11434`)

## Repository layout
```
backend/
  ├─ main.py            App setup, auth, /me, chat history, streaming /chat
  ├─ db.py              MongoDB connection (users_collection, chats_collection)
  ├─ security.py        Password hashing, JWT creation, user schemas
  ├─ ml/
  │   ├─ MlLogic.py     ML router: /models, /train (registry, preprocessing, metrics)
  │   └─ clean_router.py  Data-cleaning router
  └─ requirement.txt    Python dependencies

frontend/
  ├─ package.json, vite.config.js, index.html
  └─ src/
      ├─ main.jsx, App.jsx, index.css
      ├─ api/           api.js (axios client), auth.js (token helpers)
      └─ components/    Pages plus AIChat, AIButton, aiPanelStore, ThemeButton
```

## Prerequisites
- Python 3.10+ and Node.js 18+
- A running MongoDB (connection settings are read in `backend/db.py`)
- Ollama, with the models you want pulled (`ollama pull <model-name>`)

## Quick start: backend
1. Create and activate a Python environment, then install dependencies:
   ```bash
   cd backend
   pip install -r requirement.txt
   ```
2. Create a `.env` file. The names below are what `main.py` reads today. `db.py` and `security.py` read their own settings (database URL and token secret), so check them and add what they need.
   ```env
   model=<your-coder-model>          # used for text chats
   vision_model=<your-vision-model>  # used when images are attached
   NUM_PREDICT=512                   # optional, max tokens per reply
   ```
3. Start Ollama (`ollama serve`, or open the Ollama app) and make sure MongoDB is running.
4. Run the API from the repo root:
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

## Quick start: frontend
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173). The frontend talks to `http://localhost:8000`, and CORS in `backend/main.py` allows `localhost:5173` and `127.0.0.1:5173` only.

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | `/models` | List available ML models |
| POST | `/train` | Train selected models and return metrics |
| POST | `/auth/signup`, `/auth/login` | Create an account / get a JWT |
| GET, PUT | `/me` | Read or update your profile and custom system prompt |
| GET | `/chats` | List your chats |
| PUT, DELETE | `/chats/{id}` | Save or delete one chat |
| DELETE | `/chats` | Delete all your chats |
| POST | `/chat` | Streaming AI reply (server-sent events) |

The data-cleaning routes live in `backend/ml/clean_router.py`. Chat and profile endpoints need a Bearer token.

### `/train`
Multipart form fields:
- `file`: CSV, JSON (array of objects) or XLSX
- `target_column`: the column to predict
- `task_type`: `classification` or `regression`
- `models`: JSON array of model names
- `scaling_technique`: `standard`, `minmax`, `robust` or `none`

```bash
curl -X POST "http://localhost:8000/train" \
  -F "file=@/path/to/dataset.csv" \
  -F 'target_column=label' \
  -F 'task_type=classification' \
  -F 'scaling_technique=standard' \
  -F 'models=["Logistic Regression","Random Forest"]'
```

Metrics returned per model: Accuracy, Precision, Recall and F1 for classification; RMSE, MAE and R² for regression, plus the number of test samples. The best model is ranked by Accuracy (classification) or R² (regression).

### `/chat`
Multipart form fields: `message`, `history` (JSON array of `{role, content}`), optional `context` (text summary), and optional `files`. The response is an SSE stream of `data: {"t": "<token>"}` events ending with `data: [DONE]`.

## Models
`GET /models` is the source of truth. The registry includes Linear Regression, Logistic Regression, Decision Tree, Random Forest, Support Vector Machine, K-Nearest Neighbors, AdaBoost and Gradient Boosting. Each entry says whether it supports classification, regression or both.

## Dataset and training notes
- Non-numeric features are one-hot encoded and numeric NaNs are filled with medians.
- The scaler you choose is applied to the features before training.
- For classification the target is factorized automatically. For regression, non-numeric targets are coerced to numbers and rows with invalid targets are dropped.
- Data is split into train and test sets once, and metrics come from the test set.

## Troubleshooting
- **`[WinError 10061] connection refused` in the chat:** Ollama is not running. Start it with `ollama serve` and check `ollama list`.
- **"Couldn't load your chats":** the backend or MongoDB is not running.
- **Notebook stuck on "Loading Python...":** it needs internet access to download Pyodide. Use "Try again" once you are online.
- **First AI reply is slow:** Ollama is loading the model into memory.

## Known limitations
- Model ranking comes from a **single train/test split**, with no cross-validation or baseline model, so close scores can be noise, especially on small or imbalanced data.
- No automated tests or CI yet.
- Local setup only: CORS is fixed to localhost, the JWT is kept in browser storage, and there is no rate limiting.
- The AI runs on small local models and can give wrong explanations. Check answers against the numbers shown.