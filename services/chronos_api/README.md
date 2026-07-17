# Chronos Forecast API

Local FastAPI service for Kawal productivity forecasting with Chronos-2.

## Setup

Use a Python environment with `pip`, then install:

```bash
python -m pip install -r services/chronos_api/requirements.txt
```

The first forecast request downloads `amazon/chronos-2` model weights.

On Windows, prefer the official CPython installer or conda. MSYS Python may try to build scientific packages such as pandas and numpy from source instead of using wheels.

## Run

```bash
python -m uvicorn services.chronos_api.main:app --host 127.0.0.1 --port 8001
```

The Bun API expects:

```bash
CHRONOS_API_URL=http://127.0.0.1:8001
```

## Endpoints

```text
GET /health
POST /forecast
```

`/forecast` accepts aligned historical arrays for completed quantity, worker-hours, break minutes, and active workers. It returns Chronos model output plus operational delay and crew guidance.
