from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, root_validator, validator

MODEL_ID = "amazon/chronos-2"

app = FastAPI(title="Kawal Chronos Forecast API", version="0.1.0")
_pipeline = None
_load_error: str | None = None


class ForecastRequest(BaseModel):
    historical_completed_quantity: list[float] = Field(min_items=1)
    worker_hours: list[float] = Field(min_items=1)
    break_minutes: list[float] = Field(min_items=1)
    active_workers: list[float] = Field(min_items=1)
    prediction_length: int = Field(default=4, ge=1, le=24)

    @root_validator(pre=True)
    def accept_camel_case_payload(cls, values: dict[str, Any]) -> dict[str, Any]:
        aliases = {
            "historicalCompletedQuantity": "historical_completed_quantity",
            "workerHours": "worker_hours",
            "breakMinutes": "break_minutes",
            "activeWorkers": "active_workers",
            "predictionLength": "prediction_length",
        }
        for camel_key, snake_key in aliases.items():
            if camel_key in values and snake_key not in values:
                values[snake_key] = values[camel_key]
        return values

    @validator("worker_hours", "active_workers")
    def positive_values(cls, values: list[float]) -> list[float]:
        return [max(value, 0.1) for value in values]


class ForecastResponse(BaseModel):
    futureProductivity: str
    delayPrediction: str
    suggestedAdditionalCrew: int
    forecastVersion: Literal["chronos-2-fastapi-v1"]
    confidence: Literal["COLD_START", "INFERRED", "HISTORICAL"]
    model: str
    modelStatus: Literal["READY", "UNAVAILABLE"]
    forecastValues: list[float]


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": _load_error is None,
        "model": MODEL_ID,
        "model_loaded": _pipeline is not None,
        "error": _load_error,
    }


@app.post("/forecast", response_model=ForecastResponse)
def forecast(request: ForecastRequest) -> ForecastResponse:
    context_df = build_context_frame(request)

    try:
        pipeline = get_pipeline()
        prediction_df = pipeline.predict_df(
            context_df,
            prediction_length=request.prediction_length,
            quantile_levels=[0.1, 0.5, 0.9],
            id_column="item_id",
            timestamp_column="timestamp",
            target="target",
        )
    except Exception as exc:
        return fallback_forecast(request, context_df, f"Chronos inference unavailable: {exc}")

    values = extract_forecast_values(prediction_df)
    if not values:
        return fallback_forecast(request, context_df, "Chronos returned no forecast values")

    median_value = values[len(values) // 2]
    previous_productivity = context_df["target"].tail(min(3, len(context_df))).mean()
    suggested_crew = 1 if median_value < previous_productivity * 0.85 else 0
    delay_prediction = (
        "Delay risk elevated from Chronos productivity forecast; add one worker or move start earlier."
        if suggested_crew
        else "Delay risk low under Chronos productivity forecast."
    )

    return ForecastResponse(
        futureProductivity=f"{median_value:.2f} units/worker-hour",
        delayPrediction=delay_prediction,
        suggestedAdditionalCrew=suggested_crew,
        forecastVersion="chronos-2-fastapi-v1",
        confidence=infer_confidence(request),
        model=MODEL_ID,
        modelStatus="READY",
        forecastValues=[round(value, 4) for value in values],
    )


def fallback_forecast(request: ForecastRequest, context_df: Any, reason: str) -> ForecastResponse:
    target_values = [float(value) for value in context_df["target"].dropna().tolist()]
    last_value = target_values[-1] if target_values else 1.0
    previous_value = target_values[-2] if len(target_values) > 1 else last_value
    trend = last_value - previous_value
    fatigue_drag = sum(request.break_minutes) / max(1, len(request.break_minutes)) / 120
    values = [
        max(0.05, last_value + (trend * (index + 1) * 0.45) - fatigue_drag)
        for index in range(request.prediction_length)
    ]
    median_value = values[len(values) // 2]
    previous_productivity = sum(target_values[-3:]) / max(1, min(3, len(target_values)))
    suggested_crew = 1 if median_value < previous_productivity * 0.85 else 0

    return ForecastResponse(
        futureProductivity=f"{median_value:.2f} units/worker-hour",
        delayPrediction=(
            "Fallback forecast: productivity may miss the required pace; add one worker or reduce rework."
            if suggested_crew
            else "Fallback forecast: current productivity trend is close to the required pace."
        ),
        suggestedAdditionalCrew=suggested_crew,
        forecastVersion="chronos-2-fastapi-v1",
        confidence=infer_confidence(request),
        model=f"{MODEL_ID} fallback",
        modelStatus="UNAVAILABLE",
        forecastValues=[round(value, 4) for value in values],
    )


def get_pipeline():
    global _pipeline, _load_error

    if _pipeline is not None:
        return _pipeline

    try:
        from chronos import Chronos2Pipeline

        _pipeline = Chronos2Pipeline.from_pretrained(MODEL_ID, device_map="cpu")
        _load_error = None
        return _pipeline
    except Exception as exc:
        _load_error = str(exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "Chronos-2 model is unavailable. Install services/chronos_api/requirements.txt "
                "and allow the model weights to download locally."
            ),
        ) from exc


def build_context_frame(request: ForecastRequest) -> Any:
    try:
        import pandas as pd
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="pandas is required for Chronos inference. Install services/chronos_api/requirements.txt in the Python environment.",
        ) from exc

    length = min(
        len(request.historical_completed_quantity),
        len(request.worker_hours),
        len(request.break_minutes),
        len(request.active_workers),
    )
    if length < 1:
        raise HTTPException(status_code=400, detail="At least one aligned historical row is required")

    end = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    timestamps = [end - timedelta(hours=length - index - 1) for index in range(length)]
    rows = []

    for index in range(length):
        worker_hours = max(request.worker_hours[index], 0.1)
        target = request.historical_completed_quantity[index] / worker_hours
        rows.append(
            {
                "item_id": "site-productivity",
                "timestamp": timestamps[index],
                "target": target,
                "worker_hours": request.worker_hours[index],
                "break_minutes": request.break_minutes[index],
                "active_workers": request.active_workers[index],
            }
        )

    return pd.DataFrame(rows)


def extract_forecast_values(prediction_df: Any) -> list[float]:
    for column in ["0.5", 0.5, "mean", "target"]:
        if column in prediction_df.columns:
            return [float(value) for value in prediction_df[column].dropna().tolist()]

    numeric_columns = prediction_df.select_dtypes(include="number").columns
    if len(numeric_columns) == 0:
        return []

    return [float(value) for value in prediction_df[numeric_columns[-1]].dropna().tolist()]


def infer_confidence(request: ForecastRequest) -> Literal["COLD_START", "INFERRED", "HISTORICAL"]:
    history_length = min(
        len(request.historical_completed_quantity),
        len(request.worker_hours),
        len(request.break_minutes),
        len(request.active_workers),
    )
    if history_length < 3:
        return "COLD_START"
    if any(value > 0 for value in request.break_minutes):
        return "INFERRED"
    return "HISTORICAL"
