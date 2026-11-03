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
import { JsonObject, QueryFormData } from '@superset-ui/core';

/**
 * The fields that decide what a chart looks like.
 *
 * Everything else a chart save can carry -- its name, its cache timeout,
 * its owners -- leaves the drawing exactly as it is.
 */
export const CHART_DRAWING_FIELDS = [
  'params',
  'query_context',
  'viz_type',
  'datasource_id',
  'datasource_type',
] as const;

/**
 * Is there a different chart in this change, or only a different label on
 * the same one?
 *
 * Asked of ``changed_fields`` rather than of the payload, because the two
 * do not agree and the payload is the misleading one. Explore's Save posts
 * every control's current value on every save, so the captured body of a
 * *rename* still carries ``params`` in full -- byte-identical to what is
 * stored. Keying on "is ``params`` present" therefore offered a preview of
 * a chart that was not changing, which is the live chart on screen under a
 * label saying it is the proposal: the exact failure the preview exists to
 * avoid.
 *
 * ``changed_fields`` is computed on the server against the live asset
 * (``changes.py:changed_fields``), so it says what actually moved.
 */
export function hasProposedChart(changedFields: string[] | undefined): boolean {
  return (changedFields ?? []).some(field =>
    (CHART_DRAWING_FIELDS as readonly string[]).includes(field),
  );
}

/**
 * The form data the proposed chart would be drawn from.
 *
 * Composed the way approval composes it: the captured body laid over what
 * the chart is now, because the body is a field-level request and not a
 * snapshot.
 *
 * The base is the captured ``params`` when the save carried it, and the
 * live chart's own form data when it did not. That second case is real: a
 * REST ``PUT`` that changes only ``viz_type``, or only the datasource,
 * sends no params at all, and those are changes to the drawing that used
 * to get no preview.
 */
export function proposedChartFormData(
  live: QueryFormData | undefined,
  payload: JsonObject | undefined,
): QueryFormData | null {
  const body = payload ?? {};
  let base: JsonObject | undefined;

  if (typeof body.params === 'string') {
    try {
      const parsed = JSON.parse(body.params);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as JsonObject;
      }
    } catch {
      // A body that will not parse is a body approval would fail on too.
      // Saying so belongs to the panel; here it means fall back to the live
      // chart, which at least draws the fields the payload *can* supply.
      base = undefined;
    }
  }
  if (!base) {
    base = live as unknown as JsonObject | undefined;
  }
  if (!base) {
    return null;
  }

  const vizType =
    (body.viz_type as string | undefined) ??
    (base.viz_type as string | undefined) ??
    live?.viz_type;
  if (!vizType) {
    return null;
  }

  const datasourceId = body.datasource_id as number | undefined;
  const datasourceType = body.datasource_type as string | undefined;
  const datasource =
    datasourceId != null && datasourceType
      ? `${datasourceId}__${datasourceType}`
      : ((base.datasource as string | undefined) ?? live?.datasource);
  if (!datasource) {
    return null;
  }

  return {
    ...base,
    viz_type: vizType,
    datasource,
    // Drawn as an unsaved chart so the request never lands in the live
    // chart's cache slot. Without this the reviewer's preview and what
    // viewers are served share a cache key, and whichever ran last wins.
    slice_id: 0,
  } as QueryFormData;
}
