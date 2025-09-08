/**
 * aiSummary
 *
 * Lightweight AI summary helper for charts.
 * - Prefers summarizing structured data; can optionally include a snapshot image.
 * - Uses a pluggable backend endpoint if provided via options or at runtime
 *   as window['__AI_SUMMARY_ENDPOINT__'].
 * - If the endpoint fails or is missing, returns a small generic 3-line summary.
 */

import { ensureIsArray } from '@superset-ui/core';

export type SummaryMode = 'data' | 'image' | 'auto';

export interface ChartSummaryInput {
  vizType: string;
  dataSample?: unknown;
  imageBase64?: string;
  title?: string;
  description?: string;
  filters?: Record<string, unknown>;
  timeRange?: string | null;
  customSystemPrompt?: string;
}

export interface GenerateSummaryOptions {
  mode?: SummaryMode;
  model?: string;
  endpoint?: string; // custom proxy endpoint that returns { summary: string }
  apiKey?: string; // OpenAI key (only for direct client calls; prefer endpoint)
  timeoutMs?: number;
  signal?: AbortSignal;
}

function safeSlice<T>(arr: T[], max: number): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, Math.max(0, max));
}

function summarizeShape(value: any): any {
  // Produce a compact representation to keep prompts tiny
  if (Array.isArray(value)) {
    const head = safeSlice(value, 20);
    return head.map(row => {
      if (row && typeof row === 'object') {
        const out: Record<string, unknown> = {};
        Object.entries(row as Record<string, unknown>).forEach(([k, v]) => {
          if (typeof v === 'string') {
            out[k] = (v as string).slice(0, 120);
          } else if (typeof v === 'number' || typeof v === 'boolean') {
            out[k] = v;
          } else if (v instanceof Date) {
            out[k] = v.toISOString();
          } else {
            out[k] = typeof v;
          }
        });
        return out;
      }
      return row;
    });
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value).forEach(([k, v]) => {
      out[k] = Array.isArray(v) ? `array(${v.length})` : typeof v;
    });
    return out;
  }
  return typeof value;
}

export function extractLightweightData(queriesData: unknown): unknown {
  const arr = ensureIsArray(queriesData);
  if (!arr.length) return null;
  const first = arr[0] as any;
  // The query payload shapes vary a lot; try common keys
  const data = first?.data ?? first?.records ?? first?.result ?? first;
  return summarizeShape(data);
}

// Raw sampler: returns minimally processed data suitable for external services
// Caps at 200 rows to keep payloads manageable
export function extractRawDataSample(queriesData: unknown): unknown[] | null {
  const arr = ensureIsArray(queriesData);
  if (!arr.length) return null;
  const first = arr[0] as any;
  const data = first?.data ?? first?.records ?? first?.result ?? first;
  if (!Array.isArray(data)) return null;
  return data.slice(0, 200);
}

export async function generateSummary(
  input: ChartSummaryInput,
  options?: GenerateSummaryOptions,
): Promise<string> {
  const endpoint =
    'https://api.intelligence.fynd.com/service/panel/analytics/ai/sql-helper/explain-chart';

  // Build payload for custom API
  const payload = {
    chart_data: {
      vizType: input.vizType,
      dataSample: input.dataSample,
      title: input.title,
      description: input.description,
      custom_system_prompt: input.customSystemPrompt,
    } as Record<string, unknown>,
  };

  // Add optional metadata from URL query params if present
  try {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    const cd = payload.chart_data as Record<string, unknown>;

    const currencyCode = params.get('currency_code');
    if (currencyCode) cd.currency_code = currencyCode;

    const timezone = params.get('timezone');
    if (timezone) cd.timezone = timezone;

    const countryCode = params.get('country_code');
    if (countryCode) cd.country_code = countryCode;

    const country = params.get('country');
    if (country) cd.country = country;
  } catch {
    // best effort only
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 15000,
  );
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.signal ?? controller.signal,
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`AI endpoint error ${res.status}`);
    const json = await res.json();
    const summary = json?.data?.result?.insight;
    if (!summary || typeof summary !== 'string') {
      throw new Error('Invalid AI response');
    }
    return summary;
  } finally {
    clearTimeout(timeout);
  }
}
