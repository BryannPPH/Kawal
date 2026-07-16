export type ChronosForecastInput = {
  historicalCompletedQuantity: number[];
  workerHours: number[];
  breakMinutes: number[];
  activeWorkers: number[];
  predictionLength?: number;
};

export type ChronosForecastOutput = {
  futureProductivity: string;
  delayPrediction: string;
  suggestedAdditionalCrew: number;
  forecastVersion: 'chronos-2-fastapi-v1';
  confidence: 'COLD_START' | 'INFERRED' | 'HISTORICAL';
  model: string;
  modelStatus: 'READY' | 'UNAVAILABLE';
  forecastValues: number[];
};

export class ChronosServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChronosServiceError';
  }
}

const chronosApiUrl = process.env.CHRONOS_API_URL ?? 'http://127.0.0.1:8001';
const chronosRequestTimeoutMs = Number(process.env.CHRONOS_REQUEST_TIMEOUT_MS ?? 3000);

export async function forecastProductivity(input: ChronosForecastInput): Promise<ChronosForecastOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), chronosRequestTimeoutMs);

  const response = await fetch(`${chronosApiUrl}/forecast`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      historical_completed_quantity: input.historicalCompletedQuantity,
      worker_hours: input.workerHours,
      break_minutes: input.breakMinutes,
      active_workers: input.activeWorkers,
      prediction_length: input.predictionLength ?? 4
    })
  }).catch((error) => {
    const message = error instanceof Error && error.name === 'AbortError'
      ? `Chronos model did not respond within ${chronosRequestTimeoutMs}ms`
      : error instanceof Error ? error.message : 'Chronos model request failed';
    throw new ChronosServiceError(message);
  }).finally(() => clearTimeout(timeout));

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.detail === 'string' ? payload.detail : `Chronos service returned ${response.status}`;
    throw new ChronosServiceError(message);
  }

  return {
    futureProductivity: String(payload.futureProductivity),
    delayPrediction: String(payload.delayPrediction),
    suggestedAdditionalCrew: Number(payload.suggestedAdditionalCrew ?? 0),
    forecastVersion: 'chronos-2-fastapi-v1',
    confidence: normalizeConfidence(payload.confidence),
    model: String(payload.model ?? 'amazon/chronos-2'),
    modelStatus: 'READY',
    forecastValues: Array.isArray(payload.forecastValues) ? payload.forecastValues.map(Number) : []
  };
}

export function chronosUnavailableForecast(reason: string): ChronosForecastOutput {
  return {
    futureProductivity: 'Chronos model failed',
    delayPrediction: `There are failures with the Chronos model: ${reason}`,
    suggestedAdditionalCrew: 0,
    forecastVersion: 'chronos-2-fastapi-v1',
    confidence: 'COLD_START',
    model: 'amazon/chronos-2',
    modelStatus: 'UNAVAILABLE',
    forecastValues: []
  };
}

function normalizeConfidence(value: unknown): ChronosForecastOutput['confidence'] {
  return value === 'HISTORICAL' || value === 'INFERRED' || value === 'COLD_START' ? value : 'INFERRED';
}
