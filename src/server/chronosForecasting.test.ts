import { afterEach, describe, expect, it, vi } from 'vitest';
import { chronosUnavailableForecast, forecastProductivity } from './chronosForecasting';

const originalFetch = globalThis.fetch;

describe('Chronos-2 FastAPI client', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the FastAPI Chronos forecast response', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      futureProductivity: '4.2 units/worker-hour',
      delayPrediction: 'Delay risk low under Chronos productivity forecast.',
      suggestedAdditionalCrew: 0,
      confidence: 'HISTORICAL',
      model: 'amazon/chronos-2',
      forecastValues: [4.1, 4.2, 4.3]
    }), { status: 200 })) as typeof fetch;

    const forecast = await forecastProductivity({
      historicalCompletedQuantity: [70, 78, 80],
      workerHours: [18, 19, 20],
      breakMinutes: [20, 25, 30],
      activeWorkers: [3, 3, 4]
    });

    expect(forecast).toMatchObject({
      futureProductivity: '4.2 units/worker-hour',
      forecastVersion: 'chronos-2-fastapi-v1',
      confidence: 'HISTORICAL',
      modelStatus: 'READY'
    });
  });

  it('creates an explicit unavailable forecast without formula fallback', () => {
    expect(chronosUnavailableForecast('Chronos service unavailable')).toMatchObject({
      futureProductivity: 'Chronos model failed',
      delayPrediction: 'There are failures with the Chronos model: Chronos service unavailable',
      modelStatus: 'UNAVAILABLE',
      forecastValues: []
    });
  });
});
