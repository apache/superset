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
 * Single source of truth for the per-chart "screenshot readiness beacon"
 * contract published on each chart's root DOM node.
 *
 * A backend screenshot/PDF pipeline (and a later frontend MutationObserver
 * beacon) observes this attribute to decide when a chart has settled into a
 * stable, paint-complete state. Every render branch of `Chart.tsx` must set
 * `CHART_STATUS_ATTR` on its root DOM node to one of `CHART_STATUS_ATTR_VALUES`.
 *
 * This module intentionally holds only the attribute name, its allowed
 * values, and the mapping from a Redux `chartStatus` to an attribute value.
 * It must never reference CSS class names: `data-*` attributes have no
 * styling hooks in this codebase, and this contract is not the place to
 * introduce one.
 */
import type { ChartStatus } from 'src/explore/types';

/** The DOM attribute name published on each chart's root node. */
export const CHART_STATUS_ATTR = 'data-chart-status';

/**
 * Allowed values for `CHART_STATUS_ATTR`.
 *
 * - `pending`: no chart status yet, or a non-terminal/unrecognized status.
 * - `loading`: a query is in flight, or data has arrived but the
 *   visualization has not yet committed to the DOM.
 * - `rendered`: the visualization has committed to the DOM (terminal).
 * - `failed`: the query or render failed (terminal).
 * - `stopped`: the query was stopped, or the chart is in a non-error
 *   Explore-preview state (missing controls, ready-to-run) (terminal).
 */
export const CHART_STATUS_ATTR_VALUES = {
  PENDING: 'pending',
  LOADING: 'loading',
  RENDERED: 'rendered',
  FAILED: 'failed',
  STOPPED: 'stopped',
} as const;

export type ChartStatusAttrValue =
  (typeof CHART_STATUS_ATTR_VALUES)[keyof typeof CHART_STATUS_ATTR_VALUES];

/**
 * Maps a Redux `chartStatus` value to the `CHART_STATUS_ATTR` value for the
 * shared success/loading/pending render branch of `Chart.tsx`.
 *
 * The `failed` and `stopped` chart statuses are handled by their own render
 * branches (which may need additional local context, e.g. whether the
 * datasource is still loading) and are included here only for completeness.
 */
export function getChartStatusAttrValue(
  chartStatus: ChartStatus | '' | null | undefined,
): ChartStatusAttrValue {
  switch (chartStatus) {
    case 'loading':
      return CHART_STATUS_ATTR_VALUES.LOADING;
    case 'success':
      // Data has arrived but the visualization hasn't committed to the DOM
      // yet. This is non-terminal; the terminal "rendered" value is
      // published later, on render commit, via chartRenderingSucceeded.
      return CHART_STATUS_ATTR_VALUES.LOADING;
    case 'rendered':
      return CHART_STATUS_ATTR_VALUES.RENDERED;
    case 'failed':
      return CHART_STATUS_ATTR_VALUES.FAILED;
    case 'stopped':
      return CHART_STATUS_ATTR_VALUES.STOPPED;
    case null:
    case undefined:
    case '':
    default:
      // Fail-safe catch-all: pre-fetch, a failed-chart datasource-retry
      // reset, or any other/future status not enumerated above.
      return CHART_STATUS_ATTR_VALUES.PENDING;
  }
}
