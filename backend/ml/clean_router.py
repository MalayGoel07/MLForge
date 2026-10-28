import io
import json
import numpy as np
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sklearn.preprocessing import PowerTransformer
from fastapi import Depends
from backend.security import get_current_active_user

router = APIRouter(prefix="/clean", tags=["clean"], dependencies=[Depends(get_current_active_user)])


def read_df(file: UploadFile) -> pd.DataFrame:
    raw = file.file.read(10 * 1024 * 1024 + 1)
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "File exceeds the 10 MB limit.")
    name = (file.filename or "").lower()
    try:
        if name.endswith(".csv"):
            return pd.read_csv(io.BytesIO(raw))
        if name.endswith(".json"):
            return pd.read_json(io.BytesIO(raw))
        if name.endswith(".xlsx"):
            return pd.read_excel(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(400, f"Could not read file: {e}")
    raise HTTPException(400, "Unsupported file type. Use .csv, .json or .xlsx")

def is_num(s: pd.Series) -> bool:
    return pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s)
def num_cols(df, skip=()):
    return [c for c in df.columns if is_num(df[c]) and c not in skip]
def cat_cols(df, skip=()):
    return [c for c in df.columns if not is_num(df[c]) and c not in skip]
def safe(x):
    if x is None:return None
    x = float(x)
    return x if np.isfinite(x) else None


def col_profile(df: pd.DataFrame, c: str) -> dict:
    s = df[c]
    base = {
        "name": str(c),
        "missing": int(s.isna().sum()),
        "missing_pct": round(float(s.isna().mean() * 100), 2),
        "unique": int(s.nunique()),
    }
    if not is_num(s):
        return {**base, "dtype": "categorical", "outlier_count": 0}

    v = s.dropna().astype(float)
    if v.empty:
        return {**base, "dtype": "numeric", "skew": 0, "outlier_count": 0}

    q1, med, q3 = v.quantile([0.25, 0.5, 0.75]).tolist()
    iqr = q3 - q1
    lo_f, hi_f = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    inside = v[(v >= lo_f) & (v <= hi_f)]
    outl = v[(v < lo_f) | (v > hi_f)]
    sample = outl.sample(min(80, len(outl)), random_state=0).tolist() if len(outl) else []
    counts, edges = np.histogram(v, bins=20)
    skew = v.skew() if len(v) > 2 else 0

    return {
        **base,
        "dtype": "numeric",
        "skew": round(safe(skew) or 0, 3),
        "mean": safe(v.mean()),
        "std": safe(v.std()),
        "min": safe(v.min()),
        "q1": safe(q1),
        "median": safe(med),
        "q3": safe(q3),
        "max": safe(v.max()),
        "whisker_low": safe(inside.min() if len(inside) else q1),
        "whisker_high": safe(inside.max() if len(inside) else q3),
        "outlier_count": int(len(outl)),
        "outliers": sample,
        "hist": {"counts": counts.tolist(), "edges": [safe(e) for e in edges]},
    }


def profile(df: pd.DataFrame) -> dict:
    cols = [col_profile(df, c) for c in df.columns]
    skews = [abs(c["skew"]) for c in cols if c["dtype"] == "numeric" and "skew" in c]
    return {
        "summary": {
            "rows": int(len(df)),
            "cols": int(df.shape[1]),
            "missing_cells": int(df.isna().sum().sum()),
            "duplicate_rows": int(df.duplicated().sum()),
            "outlier_cells": int(sum(c["outlier_count"] for c in cols)),
            "mean_abs_skew": round(float(np.mean(skews)), 3) if skews else 0,
        },
        "columns": cols,
    }

def apply_pipeline(df: pd.DataFrame, cfg: dict):
    df = df.copy()
    log = []
    skip = set(cfg.get("excluded_columns", []))

    # 1. text cleanup
    if cfg.get("trim_text"):
        for c in cat_cols(df, skip):
            if df[c].dtype == object:
                s = df[c].where(df[c].isna(), df[c].astype(str).str.strip())
                if cfg.get("lowercase_text"):
                    s = s.where(s.isna(), s.astype(str).str.lower())
                df[c] = s.replace(r"^\s*$", np.nan, regex=True)
        log.append("Trimmed text" + (" and lowercased it" if cfg.get("lowercase_text") else ""))

    # 2. duplicates
    if cfg.get("drop_duplicates"):
        n = len(df)
        df = df.drop_duplicates()
        log.append(f"Removed {n - len(df)} duplicate rows")

    # 3. sparse columns
    m = cfg.get("drop_missing_cols", {})
    if m.get("enabled"):
        thr = float(m.get("threshold", 60)) / 100
        drop = [c for c in df.columns if c not in skip and df[c].isna().mean() > thr]
        df = df.drop(columns=drop)
        log.append(f"Dropped {len(drop)} columns with over {m.get('threshold')}% missing" + (f": {', '.join(map(str, drop))}" if drop else ""))

    # 4. constant columns
    if cfg.get("drop_constant_cols"):
        drop = [c for c in df.columns if c not in skip and df[c].nunique(dropna=True) <= 1]
        df = df.drop(columns=drop)
        log.append(f"Dropped {len(drop)} constant columns" + (f": {', '.join(map(str, drop))}" if drop else ""))

    # 5. numeric imputation
    n_cfg = cfg.get("impute_numeric", {})
    if n_cfg.get("enabled"):
        cols = [c for c in num_cols(df, skip) if df[c].isna().any()]
        strat = n_cfg.get("strategy", "median")
        if strat == "drop_rows":
            n = len(df)
            df = df.dropna(subset=cols)
            log.append(f"Dropped {n - len(df)} rows with missing numeric values")
        else:
            for c in cols:
                if strat == "mean":
                    fill = df[c].mean()
                elif strat == "median":
                    fill = df[c].median()
                elif strat == "mode":
                    fill = df[c].mode().iloc[0]
                else:
                    fill = n_cfg.get("constant", 0)
                df[c] = df[c].fillna(fill)
            log.append(f"Filled missing values in {len(cols)} numeric columns using {strat}")

    # 6. categorical imputation
    c_cfg = cfg.get("impute_categorical", {})
    if c_cfg.get("enabled"):
        cols = [c for c in cat_cols(df, skip) if df[c].isna().any()]
        strat = c_cfg.get("strategy", "mode")
        if strat == "drop_rows":
            n = len(df)
            df = df.dropna(subset=cols)
            log.append(f"Dropped {n - len(df)} rows with missing text values")
        else:
            for c in cols:
                fill = df[c].mode().iloc[0] if strat == "mode" and not df[c].mode().empty else c_cfg.get("constant", "unknown")
                df[c] = df[c].fillna(fill)
            log.append(f"Filled missing values in {len(cols)} text columns using {strat}")

    # 7. outliers
    o = cfg.get("outliers", {})
    if o.get("enabled"):
        method = o.get("method", "iqr_clip")
        cols = num_cols(df, skip)
        keep = pd.Series(True, index=df.index)
        clipped = 0
        for c in cols:
            s = df[c]
            if s.dropna().empty:
                continue
            if method.startswith("iqr"):
                q1, q3 = s.quantile(0.25), s.quantile(0.75)
                k = float(o.get("factor", 1.5))
                lo, hi = q1 - k * (q3 - q1), q3 + k * (q3 - q1)
            elif method == "percentile_clip":
                lo, hi = s.quantile(float(o.get("lower_pct", 1)) / 100), s.quantile(float(o.get("upper_pct", 99)) / 100)
            else:  # zscore_remove
                mu, sd = s.mean(), s.std()
                if not sd:
                    continue
                z = float(o.get("z", 3))
                lo, hi = mu - z * sd, mu + z * sd
            if method in ("iqr_clip", "percentile_clip"):
                clipped += int(((s < lo) | (s > hi)).sum())
                df[c] = s.clip(lo, hi)
            else:
                keep &= ~((s < lo) | (s > hi)).fillna(False)
        if method in ("iqr_remove", "zscore_remove"):
            n = len(df)
            df = df[keep]
            log.append(f"Removed {n - len(df)} outlier rows ({method})")
        else:
            log.append(f"Clipped {clipped} outlier values ({method})")

    # 8. skewness
    sk = cfg.get("skew", {})
    if sk.get("enabled"):
        thr = float(sk.get("threshold", 0.75))
        method = sk.get("method", "yeo-johnson")
        done = []
        for c in num_cols(df, skip):
            s = df[c]
            if s.nunique() <= 2 or s.dropna().shape[0] < 3 or abs(s.skew()) <= thr:
                continue
            mask = s.notna()
            mn = s[mask].min()
            if method == "log":
                df[c] = np.log1p(s - mn) if mn < 0 else np.log1p(s)
            elif method == "sqrt":
                df[c] = np.sqrt(s - mn) if mn < 0 else np.sqrt(s)
            else:
                use = method
                if method == "box-cox" and mn <= 0:
                    use = "yeo-johnson"
                pt = PowerTransformer(method=use, standardize=False)
                out = df[c].astype(float)
                out[mask] = pt.fit_transform(s[mask].to_frame()).ravel()
                df[c] = out
            done.append(c)
        log.append(f"Applied {method} to {len(done)} skewed columns" + (f": {', '.join(map(str, done))}" if done else ""))

    # 9. encoding
    e = cfg.get("encode", {})
    if e.get("enabled"):
        cols = cat_cols(df, skip)
        if e.get("method") == "label":
            for c in cols:
                codes, _ = pd.factorize(df[c])
                df[c] = pd.Series(codes, index=df.index).where(codes != -1)
        else:
            df = pd.get_dummies(df, columns=cols, dtype=int)
        log.append(f"Encoded {len(cols)} text columns ({e.get('method')})")

    return df.reset_index(drop=True), log


# ---------------------------------------------------------------- routes
@router.post("/profile")
def profile_route(file: UploadFile = File(...)):
    return profile(read_df(file))


@router.post("/run")
def run_route(file: UploadFile = File(...), config: str = Form("{}")):
    df = read_df(file)
    try:
        cfg = json.loads(config)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid config")
    try:
        cleaned, log = apply_pipeline(df, cfg)
    except Exception as e:
        raise HTTPException(400, f"Cleaning failed: {e}")

    head = json.loads(cleaned.head(8).to_json(orient="split"))
    return {
        "before": profile(df),
        "after": profile(cleaned),
        "log": log,
        "csv": cleaned.to_csv(index=False),
        "preview": {"columns": head["columns"], "rows": head["data"]},
    }