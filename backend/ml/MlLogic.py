import io
import json
import sys
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile,Depends
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (MinMaxScaler,OneHotEncoder,RobustScaler,StandardScaler,)
from backend.ml import model_store
from backend.security import User, get_current_active_user
from typing import Annotated

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from backend.ml.analyzer import (analyze_dataset,create_relationship_charts,)
    from backend.ml.model_registry import (MODEL_REGISTRY,compute_metrics,get_model,)
else:
    from backend.ml.analyzer import (analyze_dataset,create_relationship_charts,)
    from backend.ml.model_registry import (MODEL_REGISTRY,compute_metrics,get_model,)

ml_router = APIRouter()
SCALER_FACTORIES = {"standard": StandardScaler,"minmax": MinMaxScaler,"robust": RobustScaler,}

@ml_router.get("/models")
async def list_models():
    descriptions = {
        "Linear Regression": "Predicts continuous values from a linear fit",
        "Logistic Regression": "Fast baseline for classification",
        "Decision Tree": "Interpretable rule-based model",
        "Random Forest": "Robust ensemble of decision trees",
        "Support Vector Machine": "Strong boundary-based model",
        "K-Nearest Neighbors": "Uses nearby observations for prediction",
        "AdaBoost": "Boosts weak learners by focusing on errors",
        "Gradient Boosting": "Sequentially improves weak learners",
    }

    return {
        "models": [
            {
                "name": name,
                "task": entry["task"],
                "needs_scaling": entry["needs_scaling"],
                "description": descriptions.get(
                    name,
                    "Available model",
                ),
            }
            for name, entry in MODEL_REGISTRY.items()
        ]
    }


def load_dataset(file: UploadFile,contents: bytes,) -> pd.DataFrame:
    filename = (file.filename or "").lower()
    try:
        if filename.endswith(".json"):
            return pd.DataFrame(json.loads(contents.decode("utf-8")))
        if filename.endswith(".xlsx"):
            return pd.read_excel(io.BytesIO(contents))
        return pd.read_csv(io.BytesIO(contents))

    except (ValueError,UnicodeDecodeError,json.JSONDecodeError,
    ) as exc:
        raise HTTPException(status_code=400,detail=f"Could not read dataset: {exc}",) from exc


@ml_router.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    contents = await file.read()
    dataset = load_dataset(file,contents,)
    try:
        return {"analysis": analyze_dataset(dataset),"charts": create_relationship_charts(dataset),}
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc),) from exc


def build_preprocessor(X: pd.DataFrame,needs_scaling: bool,scaling_technique: str,):

    numeric_columns = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_columns = X.select_dtypes(exclude=["number"]).columns.tolist()
    numeric_steps = [("imputer",SimpleImputer(strategy="median"),)]

    if needs_scaling and scaling_technique != "none":
        scaler = SCALER_FACTORIES[scaling_technique]()
        numeric_steps.append(("scaler",scaler,))

    numeric_pipeline = Pipeline(steps=numeric_steps)
    categorical_pipeline = Pipeline(
        steps=[("imputer",SimpleImputer(strategy="most_frequent"),),
               ("encoder",OneHotEncoder(handle_unknown="ignore",sparse_output=False,),),
    ])
    preprocessor = ColumnTransformer(
        transformers=[("numerical",numeric_pipeline,numeric_columns,),("categorical",categorical_pipeline,categorical_columns,),],
        remainder="drop",
    )

    return preprocessor


@ml_router.post("/train")
async def train_models(current_user: Annotated[User, Depends(get_current_active_user)],file: UploadFile = File(...),target_column: str = Form(""),task_type: str = Form(...),models: str = Form(...),scaling_technique: str = Form("standard"),):

    if scaling_technique not in {"none",*SCALER_FACTORIES,}:
        raise HTTPException(status_code=400,detail=("scaling_technique must be one of: ""standard, minmax, robust, none"),)
    if task_type not in { "classification","regression",}:
        raise HTTPException(status_code=400, detail=("task_type must be either ""'classification' or 'regression'"),)
    try:
        model_names = json.loads(models)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400,detail="models must be a JSON array",) from exc

    if not isinstance(model_names, list):
        raise HTTPException(status_code=400,detail="models must be a JSON array",)

    contents = await file.read()
    dataset = load_dataset(file,contents,)

    if dataset.empty:
        raise HTTPException(status_code=400,detail="Dataset is empty",)
    if not target_column:
        raise HTTPException(status_code=400,detail="Target column is required",)
    if target_column not in dataset.columns:
        raise HTTPException(status_code=400,detail=(f"Target column '{target_column}' ""was not found"),)

    X = dataset.drop(columns=[target_column])
    X = model_store.prepare_features(X)
    y = dataset[target_column].copy()

    if task_type == "classification":
        valid_target = y.notna()
        X = X.loc[valid_target]
        y = y.loc[valid_target]
        if y.nunique() < 2:
            raise HTTPException(status_code=400,detail=("Classification requires ""at least 2 target classes."),)
    else:
        y = pd.to_numeric(y,errors="coerce",)
        valid_target = y.notna()
        X = X.loc[valid_target]
        y = y.loc[valid_target]
        if len(y) < 2:
            raise HTTPException(status_code=400,detail=("Regression requires at least ""2 valid numeric target values."),)

    if task_type == "classification":
        X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=0.2,random_state=42,stratify=y,)
    else:
        X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=0.2,random_state=42,)
    results = {}
    pipelines = {}
    for name in model_names:
        try:
            if name not in MODEL_REGISTRY:
                raise ValueError(f"Unknown model: {name}")

            registry_entry = MODEL_REGISTRY[name]
            if (registry_entry["task"] != "both"and registry_entry["task"] != task_type):
                raise ValueError(f"{name} is not compatible with "f"{task_type}")

            model = get_model(name,task_type,)
            preprocessor = build_preprocessor(X_train,needs_scaling=registry_entry["needs_scaling"],scaling_technique=scaling_technique,)
            pipeline = Pipeline(steps=[("preprocessor",preprocessor,),("model",model,),])

            pipeline.fit(X_train,y_train,)
            pipelines[name] = pipeline
            predictions = pipeline.predict(X_test)
            metrics = compute_metrics(task_type,y_test,predictions,)
            results[name] = {"metrics": metrics,"test_samples": len(y_test),}

        except Exception as exc:
            results[name] = {"error": str(exc)}
    run_id = None
    if pipelines:
        run_id = model_store.save_run(current_user.username, pipelines, X_train, task=task_type, target=target_column,dataset_name=file.filename or "", metrics={n: r["metrics"] for n, r in results.items() if "metrics" in r},)
    return {
        "results": results,
        "train_samples": len(y_train),
        "test_samples": len(y_test),
        "features": X.shape[1],
        "task_type": task_type,
        "run_id": run_id,
    }