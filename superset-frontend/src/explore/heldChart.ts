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
 * @fileoverview A held write, composed into a chart that can be drawn.
 *
 * The counterpart of `dashboard/heldDashboard.ts`, for the same reason and in
 * the same place in the flow: a held write is a *field-level request body*,
 * not a snapshot, so turning it into something drawable means laying it over
 * the asset as it is now. That is also exactly what applying it would do, so
 * what the page draws is what applying would produce rather than a second
 * rendering of it that could disagree.
 *
 * It lives in the host because the chart it composes against is the host's:
 * Explore's live form data sits in its own store, and the holder of the write
 * has never seen it. The holder sends the fields; this makes a chart of them.
 */
import { JsonObject, QueryFormData } from '@superset-ui/core';

/**
 * Compose a held write into the chart it would produce.
 *
 * The base is the held `params` when the write carried it, and the live
 * chart's own form data when it did not. That second case is real: a REST
 * `PUT` that moves only `viz_type`, or only the datasource, sends no params
 * at all, and those are changes to the drawing.
 *
 * `null` when there is nothing drawable: no `viz_type` on either side, or no
 * datasource. A caller gets the same answer either way -- that this write
 * cannot be put on screen -- and is spared having to work out which.
 */
function compose(
  live: QueryFormData | undefined,
  heldFields: JsonObject | undefined,
  { drawAsUnsaved }: { drawAsUnsaved: boolean },
): QueryFormData | null {
  const body = heldFields ?? {};
  let base: JsonObject | undefined;

  if (typeof body.params === 'string') {
    try {
      const parsed = JSON.parse(body.params);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as JsonObject;
      }
    } catch {
      // A body that will not parse is a body applying would fail on too.
      // Saying so belongs to whoever is holding it; here it means fall back
      // to the live chart, which at least draws the fields the body *can*
      // supply.
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
    // Drawn as an unsaved chart so the query never lands in the live chart's
    // cache slot. Without this the held version and what viewers are served
    // share a cache key, and whichever ran last wins. The holder's own
    // surface keeps the real id -- see `composeHeldChartForItsHolder`.
    ...(drawAsUnsaved
      ? { slice_id: 0 }
      : { slice_id: (base.slice_id as number | undefined) ?? live?.slice_id }),
  } as QueryFormData;
}

export function composeHeldChart(
  live: QueryFormData | undefined,
  heldFields: JsonObject | undefined,
): QueryFormData | null {
  return compose(live, heldFields, { drawAsUnsaved: true });
}

/**
 * The same composition, for the holder's own editing surface.
 *
 * The difference from a reader's preview is the identity of what is drawn: a
 * reader is looking at a version they do not own and must not touch the live
 * chart's cache slot, while the holder is editing that chart and their next
 * save has to land on it. So the chart keeps its own `slice_id` here.
 *
 * That is not a new exposure. Somebody who opened the live chart and re-made
 * their edits by hand sits in exactly this state already -- an unsaved form
 * on a real `slice_id` -- which is ordinary Explore. What changes is only
 * that they no longer have to re-make them.
 */
export function composeHeldChartForItsHolder(
  live: QueryFormData | undefined,
  heldFields: JsonObject | undefined,
): QueryFormData | null {
  return compose(live, heldFields, { drawAsUnsaved: false });
}

