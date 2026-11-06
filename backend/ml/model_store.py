"""Persistence for trained model runs (MongoDB + GridFS).

A *run* is several fitted scikit-learn Pipelines trained on the same dataset, so
they share one feature schema.

  model_runs collection : one document per run (owner, schema, task, per-model metadata)
  model_files (GridFS)  : one compressed joblib file per fitted pipeline

Stored in MongoDB rather than on disk so runs survive restarts and redeploys
(Render's filesystem is ephemeral).

SECURITY: joblib/pickle files can execute code when loaded. Only load files this
server wrote itself. If you later allow uploading .pkl/.joblib files for a Model
Registry, do NOT load them in this process; use a safe format (e.g. skops) or an
isolated worker.
"""
import io
import json
import time
import uuid
from functools import lru_cache

import gridfs
import joblib
import pandas as pd
from bson import ObjectId
from pandas.api.types import is_bool_dtype, is_numeric_dtype

from backend.db import chats_collection

_db = chats_collection.database
_fs = gridfs.GridFS(_db, collection="model_files")
_runs = _db["model_runs"]
_runs.create_index([("owner", 1), ("run_id", 1)], unique=True)

MAX_OPTIONS = 50
MAX_RUNS_PER_USER = 10  # oldest runs are deleted automatically


def _json_safe(obj):
    """Round-trip through JSON so numpy types/arrays become plain Python (BSON can't store them)."""
    def default(o):
        if hasattr(o, "tolist"):
            return o.tolist()
        return str(o)
    return json.loads(json.dumps(obj, default=default))


def _f(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return None if x != x else x  # NaN -> None


# ---------- training helpers ----------
def prepare_features(X: pd.DataFrame) -> pd.DataFrame:
    """Call on X BEFORE train_test_split: string column names, bools as ints.

    Keeps the feature schema in sync with your build_preprocessor(), which treats
    `number` dtypes as numeric and everything else as categorical.
    """
    X = X.copy()
    X.columns = [str(c) for c in X.columns]
    for c in X.columns:
        if is_bool_dtype(X[c]):
            X[c] = X[c].astype(int)
    return X


def build_schema(X: pd.DataFrame) -> list[dict]:
    features = []
    for c in X.columns:
        s = X[c]
        if is_numeric_dtype(s):
            s = pd.to_numeric(s, errors="coerce")
            features.append({"name": c, "kind": "number", "min": _f(s.min()),
                             "max": _f(s.max()), "example": _f(s.median())})
        else:
            counts = s.dropna().astype(str).value_counts()
            features.append({
                "name": c, "kind": "category",
                "options": sorted(counts.index[:MAX_OPTIONS].tolist()),
                "free_text": len(counts) > MAX_OPTIONS,  # too many values for a dropdown
                "example": counts.index[0] if len(counts) else "",
            })
    return features


# ---------- persistence ----------
def save_run(owner: str, pipelines: dict, X: pd.DataFrame, *, task: str, target: str,
             dataset_name: str = "", metrics: dict | None = None) -> str:
    """pipelines: {"Random Forest": fitted_pipeline, ...}; X: prepared training features."""
    run_id = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    entries = []
    for name, pipe in pipelines.items():
        buf = io.BytesIO()
        joblib.dump(pipe, buf, compress=3)
        file_id = _fs.put(buf.getvalue(), filename=f"{run_id}-{name}.joblib", owner=owner, run_id=run_id)
        entries.append({
            "name": name,
            "file_id": file_id,
            "metrics": _json_safe((metrics or {}).get(name, {})),
            "classes": [str(c) for c in pipe.classes_] if task == "classification" else None,
        })
    _runs.insert_one({
        "owner": owner, "run_id": run_id, "created_at": time.time(),
        "dataset_name": dataset_name, "task": task, "target": target,
        "features": build_schema(X), "models": entries,
    })
    _prune(owner)
    return run_id


def _delete_doc_files(doc: dict) -> None:
    for m in doc.get("models", []):
        try:
            _fs.delete(m["file_id"])
        except Exception:
            pass


def _prune(owner: str) -> None:
    old = list(_runs.find({"owner": owner}).sort("created_at", -1).skip(MAX_RUNS_PER_USER))
    for doc in old:
        _delete_doc_files(doc)
        _runs.delete_one({"_id": doc["_id"]})
    if old:
        _load.cache_clear()


def load_meta(owner: str, run_id: str) -> dict:
    doc = _runs.find_one({"owner": owner, "run_id": run_id}, {"_id": 0, "owner": 0})
    if not doc:
        raise FileNotFoundError(run_id)
    doc["models"] = {m["name"]: {"file_id": str(m["file_id"]), "metrics": m["metrics"], "classes": m["classes"]}
                     for m in doc["models"]}
    return doc


def list_runs(owner: str) -> list[dict]:
    out = []
    for d in _runs.find({"owner": owner}, {"_id": 0, "features": 0}).sort("created_at", -1):
        out.append({"run_id": d["run_id"], "created_at": d["created_at"],
                    "dataset_name": d.get("dataset_name", ""), "task": d["task"],
                    "target": d["target"], "models": [m["name"] for m in d["models"]]})
    return out


@lru_cache(maxsize=8)
def _load(file_id: str):
    return joblib.load(io.BytesIO(_fs.get(ObjectId(file_id)).read()))


def load_pipeline(owner: str, run_id: str, meta: dict, name: str):
    # `meta` came from load_meta(owner, run_id), so its file ids belong to this user.
    return _load(meta["models"][name]["file_id"])


def delete_run(owner: str, run_id: str) -> None:
    doc = _runs.find_one_and_delete({"owner": owner, "run_id": run_id})
    if doc:
        _delete_doc_files(doc)
        _load.cache_clear()


def delete_user_runs(owner: str) -> None:
    """Call from DELETE /me so account deletion also removes saved models."""
    for doc in _runs.find({"owner": owner}):
        _delete_doc_files(doc)
    _runs.delete_many({"owner": owner})
    _load.cache_clear()