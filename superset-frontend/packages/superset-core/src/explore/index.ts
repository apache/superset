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
 * @fileoverview Explore API for Superset extensions.
 *
 * Exposes the chart currently active on the Explore surface (see
 * `navigation.getPage() === 'explore'`) so extensions can identify it and
 * read/apply control values, including preview-only customizations that
 * don't require saving the chart.
 */

/**
 * Gets the ID of the chart currently loaded in Explore.
 *
 * @returns The current chart's ID, or undefined if Explore has no chart
 * loaded, or the chart is unsaved.
 *
 * @example
 * ```typescript
 * const chartId = explore.getChartId();
 * if (chartId != null) {
 *   console.log(`Chart ID: ${chartId}`);
 * }
 * ```
 */
export declare function getChartId(): number | undefined;

/**
 * Gets all current control values (i.e. the chart's form data) for the
 * chart currently loaded in Explore. Keys are control names, e.g.
 * `viz_type`, `metrics`, `echart_options`.
 *
 * The returned object is a read-only snapshot: it is a shallow copy, so
 * nested values (e.g. `metrics`, `adhoc_filters`) are shared references
 * with Explore's internal state. Mutating them directly has no defined
 * effect on the rendered chart and may corrupt that state — use
 * {@link setControlValues} to apply changes instead.
 *
 * @returns A map of control name to its current value.
 *
 * @example
 * ```typescript
 * const values = explore.getControlValues();
 * console.log(values.viz_type, values.echart_options);
 * ```
 */
export declare function getControlValues(): Record<string, unknown>;

/**
 * Gets the current value of a single control for the chart currently
 * loaded in Explore.
 *
 * @param name The control name, e.g. `echart_options`.
 * @returns The control's current value, or undefined if unset.
 *
 * @example
 * ```typescript
 * const current = explore.getControlValue('echart_options');
 * ```
 */
export declare function getControlValue(name: string): unknown;

/**
 * Sets one or more control values on the chart currently loaded in Explore.
 * This is the same mechanism the Explore UI itself uses, so controls marked
 * `renderTrigger` (e.g. `echart_options`) re-render an instant preview in
 * place — no save and no new data query required.
 *
 * @param values A map of control name to the value it should be set to.
 * @returns Promise that resolves once the values have been applied.
 *
 * @example
 * ```typescript
 * await explore.setControlValues({
 *   echart_options: '{ title: { text: "Revenue" } }',
 * });
 * ```
 */
export declare function setControlValues(
  values: Record<string, unknown>,
): Promise<void>;

/**
 * Gets the SQL query that would run for the chart currently loaded in
 * Explore, given its current control values. Does not require the chart to
 * have been run first, and does not affect the rendered chart.
 *
 * @returns The SQL query string.
 * @throws If Explore has no chart loaded, or the query could not be
 * generated.
 *
 * @example
 * ```typescript
 * const sql = await explore.getQuery();
 * ```
 */
export declare function getQuery(): Promise<string>;

/**
 * The tabular result of a chart's data query.
 */
export interface ChartData {
  /**
   * Column names, in display order.
   */
  columns: string[];

  /**
   * Result rows, keyed by column name.
   */
  rows: Record<string, unknown>[];
}

/**
 * Gets the underlying data for the chart currently loaded in Explore, given
 * its current control values. Does not require the chart to have been run
 * first, and does not affect the rendered chart.
 *
 * @returns The result columns and rows.
 * @throws If Explore has no chart loaded, or the data could not be
 * retrieved.
 *
 * @example
 * ```typescript
 * const { columns, rows } = await explore.getChartData();
 * ```
 */
export declare function getChartData(): Promise<ChartData>;
