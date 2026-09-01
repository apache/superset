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
 * The one path either half of the Properties panel (the schema-driven form
 * and the JSON editor) writes a schema-controlled widget's control values
 * through.
 *
 * Both representations edit the same `node.props`, but neither may write to
 * it directly: a candidate is merged, sent to the backend's
 * `Widget.validate_control_values` gate — the same gate the
 * `set_widget_control_values` MCP tool commits through, reached here via its
 * REST wrapper rather than a second, frontend-authored copy of its rules —
 * and only committed to the store once that gate accepts it. A rejected
 * candidate returns its errors and touches nothing: `node.props` is read
 * here, never written to, until validation has already succeeded.
 */
import { SupersetClient } from '@superset-ui/core';
import { provider } from 'src/core/dashboard/store';

export type ControlValidationError = {
  loc: (string | number)[];
  message: string;
};

export type CommitPropsResult =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: ControlValidationError[] };

/**
 * SupersetClient rejects a non-2xx response with the raw, unparsed `Response`
 * object rather than an `Error`, so a plain `String(e)` yields the useless
 * "[object Response]". Pull the actual `{message}`/`{errors:[...]}` body
 * Superset sends back (same shape `chartData.ts` handles).
 */
export async function describeError(e: unknown): Promise<string> {
  if (typeof Response !== 'undefined' && e instanceof Response) {
    try {
      const body = await e.clone().json();
      const detail =
        body?.message ??
        (Array.isArray(body?.errors)
          ? body.errors
              .map((err: { message?: string }) => err.message)
              .join('; ')
          : undefined);
      return detail
        ? `${e.status} ${e.statusText}: ${detail}`
        : `${e.status} ${e.statusText}`;
    } catch {
      return `${e.status} ${e.statusText}`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

async function validateControlValues(
  widgetType: string,
  controlValues: Record<string, unknown>,
): Promise<ControlValidationError[]> {
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/widgets/type/${widgetType}/validate`,
    jsonPayload: { control_values: controlValues },
  });
  return (json as { result: { errors: ControlValidationError[] } }).result
    .errors;
}

/**
 * Merges `delta` onto the node's current props, validates the merged
 * candidate, and commits it to `node.props` only if the backend accepts it.
 *
 * `onBeforeCommit`, if given, runs synchronously immediately before the
 * `provider.updateProps` call — not part of the merge/validate/commit
 * contract itself, but the one hook a caller needs to both veto a commit
 * that's gone stale during the async validation round-trip (returning
 * `false` skips `updateProps` entirely — the caller's own sequence check
 * can't do this after the fact, since by then the write already landed) and
 * set a flag in the exact tick its own commit lands (e.g. `SchemaControlPanel`
 * telling its own resync effect "this `props` change was mine").
 */
export async function commitWidgetProps(
  nodeId: string,
  widgetType: string,
  delta: Record<string, unknown>,
  options?: { onBeforeCommit?: () => boolean | void },
): Promise<CommitPropsResult> {
  const node = provider.getNode(nodeId);
  const candidate = { ...node?.props, ...delta };
  const errors = await validateControlValues(widgetType, candidate);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (options?.onBeforeCommit?.() === false) {
    return { ok: false, errors: [] };
  }
  provider.updateProps(nodeId, candidate);
  return { ok: true, values: candidate };
}
