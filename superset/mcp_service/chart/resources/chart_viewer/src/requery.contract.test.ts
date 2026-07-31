/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Cross-language contract test for the widget's only outgoing tool call.
 *
 * The widget shipped for a while sending a FLAT payload
 * (`{chart_id, filter, ...}`) to `render_chart_requery`, while the tool takes a
 * single `request` model keyed by `identifier`. Every drill-down and
 * brush-to-zoom failed schema validation, and nothing caught it: the bridge
 * tests assert the bridge's own plumbing, and no test compared the payload the
 * widget builds against the schema the server publishes.
 *
 * This pins both halves to one artifact:
 *   - `__fixtures__/render_chart_requery.inputSchema.json` is generated from
 *     the live tool registration.
 *   - Here, the payloads the widget builds are validated against it.
 *   - In Python, `test_render_chart_requery_contract.py` asserts the server's
 *     schema still equals that fixture.
 *
 * So a change on either side fails a test rather than silently breaking drill.
 */
import { describe, expect, it } from 'vitest';
import schema from './__fixtures__/render_chart_requery.inputSchema.json';

interface JsonSchema {
  properties?: Record<string, unknown>;
  required?: string[];
  $defs?: Record<
    string,
    { properties?: Record<string, unknown>; required?: string[] }
  >;
}

const s = schema as JsonSchema;
const requestModel = s.$defs?.RenderChartRequeryRequest;

/**
 * Minimal structural validation: every required key present, and no key the
 * schema does not declare. That is precisely the failure mode we hit — the
 * server rejected unexpected keys and a missing `request`.
 */
function validateAgainstTool(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const topProps = Object.keys(s.properties ?? {});

  for (const req of s.required ?? []) {
    if (!(req in payload)) errors.push(`missing required top-level key: ${req}`);
  }
  for (const key of Object.keys(payload)) {
    if (!topProps.includes(key)) {
      errors.push(`unexpected top-level key: ${key}`);
    }
  }

  const request = payload.request as Record<string, unknown> | undefined;
  if (request) {
    const allowed = Object.keys(requestModel?.properties ?? {});
    for (const req of requestModel?.required ?? []) {
      if (!(req in request)) errors.push(`missing required request key: ${req}`);
    }
    for (const key of Object.keys(request)) {
      if (!allowed.includes(key)) {
        errors.push(`unexpected request key: ${key}`);
      }
    }
  }
  return errors;
}

/**
 * Mirrors how App.tsx assembles the call: a `request` envelope keyed by
 * `identifier`, spreading the interaction-specific args. Kept in lockstep with
 * `requery()` in App.tsx.
 */
function buildRequeryPayload(
  chartId: number,
  args: Record<string, unknown>,
): Record<string, unknown> {
  return { request: { identifier: chartId, ...args } };
}

describe('render_chart_requery payload matches the tool schema', () => {
  it('the fixture actually describes the tool we think it does', () => {
    // Guards against a fixture that silently became empty or malformed.
    expect(s.required).toContain('request');
    expect(requestModel).toBeDefined();
    expect(Object.keys(requestModel!.properties ?? {})).toContain('identifier');
  });

  it('accepts the click-to-drill payload', () => {
    const payload = buildRequeryPayload(113, {
      filter: { col: 'country', val: 'US' },
      granularity: 'P1D',
    });
    expect(validateAgainstTool(payload)).toEqual([]);
  });

  it('accepts the brush-to-zoom payload', () => {
    const payload = buildRequeryPayload(113, {
      time_range: '2026-01-01 : 2026-01-08',
      granularity: 'P1D',
    });
    expect(validateAgainstTool(payload)).toEqual([]);
  });

  it('accepts the reset payload (no interaction args)', () => {
    expect(validateAgainstTool(buildRequeryPayload(113, {}))).toEqual([]);
  });

  it('accepts the flat filter_col / filter_val form', () => {
    const payload = buildRequeryPayload(113, {
      filter_col: 'country',
      filter_val: 'US',
    });
    expect(validateAgainstTool(payload)).toEqual([]);
  });

  // --- the regressions this file exists to prevent -------------------------

  it('rejects the flat payload that shipped broken', () => {
    // What App.tsx used to send. The live server answered:
    //   request: Missing required argument; chart_id: Unexpected keyword
    //   argument; filter: Unexpected keyword argument
    const errors = validateAgainstTool({
      chart_id: 113,
      filter: { col: 'country', val: 'US' },
    });
    expect(errors).toContain('missing required top-level key: request');
    expect(errors).toContain('unexpected top-level key: chart_id');
  });

  it('rejects a request keyed by chart_id instead of identifier', () => {
    const errors = validateAgainstTool({ request: { chart_id: 113 } });
    expect(errors).toContain('missing required request key: identifier');
  });

  it('rejects group_by, which was removed from the contract', () => {
    // group_by was dropped because Superset's extra_form_data merge ignores
    // it — re-adding it client-side would be a silent no-op again.
    const errors = validateAgainstTool(
      buildRequeryPayload(113, { group_by: 'country' }),
    );
    expect(errors).toContain('unexpected request key: group_by');
  });
});
