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
 * Asked of ``changed_fields`` rather than of the payload, because the
 * payload cannot answer it: Explore's Save posts every control's current
 * value, so a rename's captured body carries ``params`` in full, and
 * keying on "is ``params`` present" offered the switch on every chart save
 * whatever it touched.
 *
 * ``changed_fields`` is computed on the server against the live asset
 * (``changes.py:changed_fields``). That is enough to tell a rename made
 * through the properties modal or the REST API -- which send ``slice_name``
 * alone -- from a change to the drawing.
 *
 * It is **not** enough for a rename made through Explore's own Save
 * dialog, and this is the known boundary of the switch. Measured against a
 * running instance: a rename-only Explore save on a deck.gl chart posted a
 * ``params`` blob holding 32 keys the stored chart never had, dropped 8
 * the current viz type has no control for, and re-emitted ``viewport`` at
 * full float precision. ``params`` therefore differs from the live value
 * for real, ``changed_fields`` reports it, and the switch is offered for a
 * change that draws the same chart. Nor is this only a map problem --
 * Explore also migrates ``time_range`` into ``adhoc_filters`` on save, so a
 * key the chart already had moves on an ordinary rename too.
 *
 * What the reviewer gets in that case is still truthful: approving really
 * does publish that blob, and the panel names ``slice_name`` as what
 * changed. They simply turn the switch on and watch nothing move.
 *
 * Closing it needs the live form data put through the same normalisation
 * Explore applies before posting, so the two can be compared on equal
 * terms. That is the same shape as QA-15 on the chart surface and belongs
 * with it. Until then the switch means "there is a proposal to look at",
 * not "it looks different".
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
