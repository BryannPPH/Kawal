import { db } from './database';

export type PpeCheckResult = {
  id: string;
  workerId: string;
  taskId: string | null;
  helmetDetected: boolean;
  harnessDetected: boolean;
  confidence: number;
  status: 'PASSED' | 'FAILED' | 'REVIEW';
  provider: string;
  reason: string;
  checkedAt: string;
};

type VisionResult = {
  helmetDetected: boolean;
  harnessDetected: boolean;
  confidence: number;
  reason: string;
  status?: 'PASSED' | 'FAILED' | 'REVIEW';
};

export async function runPpeCheck(input: {
  workerId: string;
  taskId?: string | null;
  imageDataUrl: string;
}): Promise<PpeCheckResult> {
  if (!input.imageDataUrl.startsWith('data:image/')) {
    throw new Error('Camera image must be a data URL');
  }

  const provider = process.env.PPE_CHECK_PROVIDER ?? (process.env.OPENAI_API_KEY ? 'openai' : 'demo');
  const vision = provider === 'openai'
    ? await runOpenAiPpeCheck(input.imageDataUrl)
    : runDemoPpeCheck();
  const status = vision.status ?? (vision.helmetDetected && vision.harnessDetected ? 'PASSED' : 'FAILED');
  const check: PpeCheckResult = {
    id: crypto.randomUUID(),
    workerId: input.workerId,
    taskId: input.taskId ?? null,
    helmetDetected: vision.helmetDetected,
    harnessDetected: vision.harnessDetected,
    confidence: Math.max(0, Math.min(1, vision.confidence)),
    status,
    provider,
    reason: vision.reason,
    checkedAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO ppe_checks (
      id, worker_id, task_id, helmet_detected, harness_detected,
      confidence, status, provider, reason, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    check.id,
    check.workerId,
    check.taskId,
    check.helmetDetected ? 1 : 0,
    check.harnessDetected ? 1 : 0,
    check.confidence,
    check.status,
    check.provider,
    check.reason,
    check.checkedAt
  );

  return check;
}

export function getLatestPpeCheck(workerId: string): PpeCheckResult | null {
  const row = db.query<PpeCheckRow, [string]>('SELECT * FROM ppe_checks WHERE worker_id = ? ORDER BY checked_at DESC LIMIT 1').get(workerId);
  return row ? mapPpeCheck(row) : null;
}

async function runOpenAiPpeCheck(imageDataUrl: string): Promise<VisionResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when PPE_CHECK_PROVIDER=openai');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PPE_MODEL ?? 'gpt-5',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'You are a construction PPE verification assistant.',
                'Inspect the image and determine whether the visible worker is wearing a safety helmet and a safety harness.',
                'Return only valid compact JSON with this exact shape:',
                '{"helmetDetected":boolean,"harnessDetected":boolean,"confidence":number,"status":"PASSED|FAILED|REVIEW","reason":"short reason"}',
                'Use REVIEW when the image is unclear, the worker is cropped, or PPE cannot be confidently verified.'
              ].join(' ')
            },
            {
              type: 'input_image',
              image_url: imageDataUrl
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI PPE check failed (${response.status}): ${detail}`);
  }

  const payload = await response.json() as OpenAiResponse;
  const text = extractOpenAiText(payload);
  const parsed = JSON.parse(text) as Partial<VisionResult>;

  if (typeof parsed.helmetDetected !== 'boolean' || typeof parsed.harnessDetected !== 'boolean' || typeof parsed.confidence !== 'number') {
    throw new Error('OpenAI PPE check returned an invalid result');
  }

  return {
    helmetDetected: parsed.helmetDetected,
    harnessDetected: parsed.harnessDetected,
    confidence: parsed.confidence,
    status: parsed.status,
    reason: parsed.reason || 'PPE check completed.'
  };
}

function runDemoPpeCheck(): VisionResult {
  return {
    helmetDetected: true,
    harnessDetected: true,
    confidence: 0.86,
    status: 'PASSED',
    reason: 'Demo mode: set PPE_CHECK_PROVIDER=openai and OPENAI_API_KEY for real camera-based PPE verification.'
  };
}

function extractOpenAiText(payload: OpenAiResponse) {
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join('');

  if (!text) {
    throw new Error('OpenAI PPE check returned no text');
  }

  return text;
}

function mapPpeCheck(row: PpeCheckRow): PpeCheckResult {
  return {
    id: row.id,
    workerId: row.worker_id,
    taskId: row.task_id,
    helmetDetected: Boolean(row.helmet_detected),
    harnessDetected: Boolean(row.harness_detected),
    confidence: row.confidence,
    status: row.status,
    provider: row.provider,
    reason: row.reason,
    checkedAt: row.checked_at
  };
}

type PpeCheckRow = {
  id: string;
  worker_id: string;
  task_id: string | null;
  helmet_detected: number;
  harness_detected: number;
  confidence: number;
  status: 'PASSED' | 'FAILED' | 'REVIEW';
  provider: string;
  reason: string;
  checked_at: string;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};
