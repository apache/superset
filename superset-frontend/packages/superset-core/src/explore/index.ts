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
 * @fileoverview Explore namespace for Superset extensions (P3).
 *
 * Exposes the current chart/explore context as a stable semantic API.
 * Normalized over Explore Redux state — extensions must not depend on
 * the Redux slice structure directly.
 */

import { Event } from '../common';

/**
 * Normalized chart context exposed to extensions during an Explore session.
 * Covers saved chart identity and transient editing context; excludes raw
 * form-data internals and datasource-implementation details.
 */
export interface ChartContext {
  /** The saved chart id, or `null` when the chart has not been persisted. */
  chartId: number | null;
  /** Display name of the saved chart, or `null` for a new/unsaved chart. */
  chartName: string | null;
  /** The visualization type currently selected in the editor. */
  vizType: string;
  /** Id of the datasource backing the chart (physical or virtual dataset). */
  datasourceId: number | null;
  /** Human-readable datasource name. */
  datasourceName: string | null;
}

/**
 * Returns the normalized chart context for the active Explore session, or
 * `undefined` when the user is not on the Explore page.
 *
 * @example
 * ```typescript
 * const chart = explore.getCurrentChart();
 * if (chart) {
 *   console.log(chart.vizType, chart.chartName);
 * }
 * ```
 */
export declare function getCurrentChart(): ChartContext | undefined;

/**
 * Event fired when the chart context changes within the active Explore session
 * (e.g. when the viz type, datasource, or saved name changes).
 * Not fired during route changes — subscribe to `navigation.onDidChangePage` for those.
 *
 * @example
 * ```typescript
 * const sub = explore.onDidChangeChart(chart => {
 *   chatbot.updateContext({ chart });
 * });
 * sub.dispose();
 * ```
 */
export declare const onDidChangeChart: Event<ChartContext>;
