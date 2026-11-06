import io
import json
import logging
import math
from typing import Annotated, Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.ml import model_store as store
from backend.security import User, get_current_active_user

log = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["predict"])

MAX_BATCH_ROWS = 5000
MAX_CSV_BYTES = 5 * 1024 * 1024


ActiveUser = Annotated[User, Depends(get_current_active_user)]


def _uid(user: User) -> str:
    return user.username  # the email; chats are keyed the same way


def _run(user, run_id: str) -> dict:
    try:
        return store.load_meta(_uid(user), run_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, "Run not found.")


def _pick_models(meta: dict, requested: list[str] | None) -> list[str]:
    names = requested or list(meta["models"])
    unknown = [n for n in names if n not in meta["models"]]
    if unknown:
        raise HTTPException(422, f"Unknown model: {', '.join(unknown)}.")
    return names


def _py(v):
    return v.item() if hasattr(v, "item") else v


def _score(pipe, X: pd.DataFrame, task: str) -> dict:
    preds = [_py(p) for p in pipe.predict(X)]
    probs = None
    if task == "classification" and hasattr(pipe, "predict_proba"):
        try:
            classes = [str(c) for c in pipe.classes_]
            probs = [{c: round(float(p), 4) for c, p in zip(classes, row)}
                     for row in pipe.predict_proba(X)]
        except Exception:  # some estimators expose predict_proba but can't compute it
            probs = None
    return {"prediction": preds, "probabilities": probs}


def _score_all(user, run_id: str, meta: dict, names: list[str], X: pd.DataFrame) -> dict:
    results = {}
    for n in names:
        try:
            pipe = store.load_pipeline(_uid(user), run_id, meta, n)
            results[n] = _score(pipe, X, meta["task"])
        except Exception:
            log.exception("Prediction failed for model %s in run %s", n, run_id)
            results[n] = {"error": "This model couldn't score the input."}
    return results


# ---------- runs ----------
@router.get("/runs")
def list_runs(user: ActiveUser):
    return {"runs": store.list_runs(_uid(user))}


@router.get("/runs/{run_id}")
def get_run(run_id: str, user: ActiveUser):
    meta = _run(user, run_id)
    public_models = {n: {k: v for k, v in m.items() if k != "file_id"} for n, m in meta["models"].items()}
    return {**meta, "models": public_models}


# ---------- manual input ----------
class SingleRequest(BaseModel):
    models: list[str] | None = None
    inputs: dict[str, Any]


@router.post("/runs/{run_id}/single")
def predict_single(run_id: str, body: SingleRequest, user: ActiveUser):
    meta = _run(user, run_id)
    names = _pick_models(meta, body.models)

    row = {}
    for f in meta["features"]:
        raw = body.inputs.get(f["name"])
        blank = raw is None or (isinstance(raw, str) and not raw.strip())
        if blank:
            row[f["name"]] = float("nan")  # the pipeline's imputers fill this in
        elif f["kind"] == "number":
            try:
                value = float(raw)
            except (TypeError, ValueError):
                raise HTTPException(422, f"“{f['name']}” must be a number.")
            if not math.isfinite(value):
                raise HTTPException(422, f"“{f['name']}” must be a finite number.")
            row[f["name"]] = value
        else:
            row[f["name"]] = str(raw)

    X = pd.DataFrame([row], columns=[f["name"] for f in meta["features"]])
    scored = _score_all(user, run_id, meta, names, X)
    results = {}
    for n, r in scored.items():
        if "error" in r:
            results[n] = r
        else:
            results[n] = {"prediction": r["prediction"][0],
                          "probabilities": r["probabilities"][0] if r["probabilities"] else None}
    return {"results": results}


# ---------- CSV batch ----------
@router.post("/runs/{run_id}/batch")
def predict_batch(run_id: str, user: ActiveUser, file: UploadFile = File(...), models: str = Form("")):
    meta = _run(user, run_id)
    try:
        requested = json.loads(models) if models else None
    except ValueError:
        raise HTTPException(422, "Invalid model list.")
    names = _pick_models(meta, requested)

    content = file.file.read(MAX_CSV_BYTES + 1)
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(413, "CSV is larger than 5 MB.")
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(422, "Couldn't read that file as CSV.")
    if df.empty:
        raise HTTPException(422, "The CSV has no rows.")

    df.columns = [str(c).strip() for c in df.columns]
    feats = meta["features"]
    missing = [f["name"] for f in feats if f["name"] not in df.columns]
    if missing:
        raise HTTPException(422, f"Missing required columns: {', '.join(missing)}.")

    warnings = []
    if len(df) > MAX_BATCH_ROWS:
        df = df.head(MAX_BATCH_ROWS)
        warnings.append(f"Only the first {MAX_BATCH_ROWS} rows were scored.")

    X = df[[f["name"] for f in feats]].copy()
    for f in feats:
        col = f["name"]
        if f["kind"] == "number":
            coerced = pd.to_numeric(X[col], errors="coerce")
            bad = int((coerced.isna() & X[col].notna()).sum())
            if bad:
                warnings.append(f"{bad} non-numeric value(s) in “{col}” were treated as missing.")
            X[col] = coerced
        else:
            X[col] = X[col].map(lambda v: v if pd.isna(v) else str(v))

    results = _score_all(user, run_id, meta, names, X)
    return {
        "total": len(df),
        "columns": list(df.columns),
        "rows": json.loads(df.to_json(orient="records")),  # NaN -> null
        "results": results,
        "warnings": warnings,
    }