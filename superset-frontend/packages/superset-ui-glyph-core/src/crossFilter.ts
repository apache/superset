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
 * Cross-Filter Utilities for Glyph Charts
 *
 * This module provides helpers for implementing cross-filtering in Glyph charts.
 * Cross-filtering allows charts to filter other charts on the dashboard when
 * users click on data points.
 *
 * ## Quick Start
 *
 * 1. Add behaviors to metadata:
 *    ```typescript
 *    metadata: {
 *      behaviors: [Behavior.InteractiveChart, Behavior.DrillToDetail, Behavior.DrillBy],
 *    }
 *    ```
 *
 * 2. Extract cross-filter props in transform:
 *    ```typescript
 *    transform: (chartProps) => {
 *      const crossFilterProps = extractCrossFilterProps(chartProps, groupby, labelMap);
 *      return { transformedProps: { ...otherProps, ...crossFilterProps } };
 *    }
 *    ```
 *
 * 3. Use event handlers in render:
 *    ```typescript
 *    render: ({ transformedProps }) => {
 *      const eventHandlers = allEventHandlers(transformedProps);
 *      return <Echart eventHandlers={eventHandlers} ... />;
 *    }
 *    ```
 */

import type {
  ChartProps,
  FilterState,
  QueryFormColumn,
  SetDataMaskHook,
  ContextMenuFilters,
} from '@superset-ui/core';

/**
 * Props needed for cross-filtering in the render component.
 * These are typically returned from the transform function and passed to Echart.
 */
export interface CrossFilterRenderProps {
  /** Groupby columns used for filtering */
  groupby: QueryFormColumn[];
  /** Maps series names to their groupby column values */
  labelMap: Record<string, string[]>;
  /** Callback to emit cross-filter data mask */
  setDataMask: SetDataMaskHook;
  /** Maps series indices to selected value names */
  selectedValues: Record<number, string>;
  /** Whether cross-filters are enabled for this chart */
  emitCrossFilters?: boolean;
  /** Context menu handler for drill actions */
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  /** Column type mapping for formatting */
  coltypeMapping?: Record<string, number>;
}

/**
 * Create a selectedValues map from filterState.
 *
 * The selectedValues map is used by the Echart component to track which
 * data points are currently selected (for highlighting).
 *
 * @param filterState - Current filter state from chartProps
 * @param seriesNames - Array of series/data point names
 * @returns Map of index -> name for selected values
 *
 * @example
 * ```typescript
 * const selectedValues = createSelectedValuesMap(
 *   filterState,
 *   transformedData.map(d => d.name),
 * );
 * ```
 */
export function createSelectedValuesMap(
  filterState: FilterState | undefined,
  seriesNames: string[],
): Record<number, string> {
  return (filterState?.selectedValues || []).reduce(
    (acc: Record<number, string>, selectedValue: string) => {
      const index = seriesNames.findIndex(name => name === selectedValue);
      if (index >= 0) {
        return { ...acc, [index]: selectedValue };
      }
      return acc;
    },
    {},
  );
}

/**
 * Extract cross-filter related props from ChartProps.
 *
 * This is a convenience function that extracts all the props needed for
 * cross-filtering from the standard ChartProps object.
 *
 * @param chartProps - The chart props from Superset
 * @param groupby - The groupby columns (dimensions) from form data
 * @param labelMap - A map from series names to their groupby values
 * @param seriesNames - Array of series/data point names for selectedValues mapping
 * @param coltypeMapping - Optional column type mapping
 *
 * @example
 * ```typescript
 * // In transform function:
 * const labelMap = data.reduce((acc, datum) => ({
 *   ...acc,
 *   [extractGroupbyLabel({ datum, groupby })]: groupby.map(col => datum[col]),
 * }), {});
 *
 * const crossFilterProps = extractCrossFilterProps(
 *   chartProps,
 *   groupby,
 *   labelMap,
 *   transformedData.map(d => d.name),
 *   coltypeMapping,
 * );
 *
 * return {
 *   transformedProps: {
 *     echartOptions,
 *     formData,
 *     width,
 *     height,
 *     refs,
 *     ...crossFilterProps,
 *   },
 * };
 * ```
 */
export function extractCrossFilterProps(
  chartProps: ChartProps,
  groupby: QueryFormColumn[],
  labelMap: Record<string, string[]>,
  seriesNames: string[],
  coltypeMapping?: Record<string, number>,
): CrossFilterRenderProps {
  const { hooks, filterState, emitCrossFilters, formData } = chartProps;
  const { setDataMask = () => {}, onContextMenu } = hooks ?? {};

  const selectedValues = createSelectedValuesMap(filterState, seriesNames);

  return {
    groupby,
    labelMap,
    setDataMask,
    selectedValues,
    emitCrossFilters,
    onContextMenu,
    coltypeMapping,
    // Also include formData for context menu formatting
    formData,
  } as CrossFilterRenderProps & { formData: unknown };
}

/**
 * Check if a data point is currently filtered (should be dimmed).
 *
 * Use this in the transform function to apply opacity/styling to
 * data points that are not part of the current filter selection.
 *
 * @param filterState - Current filter state from chartProps
 * @param name - The name/label of the data point to check
 * @returns true if the data point should be dimmed, false otherwise
 *
 * @example
 * ```typescript
 * const isFiltered = isDataPointFiltered(filterState, datum.name);
 * const opacity = isFiltered ? OpacityEnum.SemiTransparent : OpacityEnum.NonTransparent;
 * ```
 */
export function isDataPointFiltered(
  filterState: FilterState | undefined,
  name: string,
): boolean {
  return Boolean(
    filterState?.selectedValues &&
    filterState.selectedValues.length > 0 &&
    !filterState.selectedValues.includes(name),
  );
}

/**
 * Create a labelMap from data records.
 *
 * The labelMap maps series names (like "USA" or "2024-01") to their
 * corresponding groupby column values. This is needed for the cross-filter
 * event handlers to construct proper filter clauses.
 *
 * @param data - Array of data records
 * @param groupbyLabels - Array of groupby column labels
 * @param extractLabel - Function to extract the series label from a datum
 * @returns Map of label -> groupby values
 *
 * @example
 * ```typescript
 * const labelMap = createLabelMap(
 *   data,
 *   groupbyLabels,
 *   datum => extractGroupbyLabel({ datum, groupby: groupbyLabels, coltypeMapping }),
 * );
 * ```
 */
export function createLabelMap<T extends Record<string, unknown>>(
  data: T[],
  groupbyLabels: string[],
  extractLabel: (datum: T) => string,
): Record<string, string[]> {
  return data.reduce((acc: Record<string, string[]>, datum: T) => {
    const label = extractLabel(datum);
    return {
      ...acc,
      [label]: groupbyLabels.map(col => datum[col] as string),
    };
  }, {});
}
