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
import {
  AxisType,
  BinaryQueryObjectFilterClause,
  getNumberFormatter,
  getTimeFormatter,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { OrientationType } from './types';
import { formatSeriesName } from '../utils/series';

/**
 * Resolve the category (x-axis) value from an ECharts click event. Horizontal
 * bar charts hold the category at a different tuple index than vertical ones;
 * fall back to the event `name` when the data tuple is unavailable.
 */
export function getCategoryAxisValue(
  data: unknown,
  name: unknown,
  orientation?: OrientationType,
): string | number | undefined {
  const index = orientation === OrientationType.Horizontal ? 1 : 0;
  if (Array.isArray(data)) {
    const categoryAxisValue = data[index];
    if (
      typeof categoryAxisValue === 'string' ||
      typeof categoryAxisValue === 'number'
    ) {
      return categoryAxisValue;
    }
  }
  if (typeof name === 'string' || typeof name === 'number') {
    return name;
  }
  return undefined;
}

export interface TimeseriesDrillFilterParams {
  /** ECharts click event `componentType` — only `series` clicks drill. */
  componentType?: string;
  /** ECharts click event `data` tuple. */
  data: unknown;
  /** ECharts click event `name`. */
  name: unknown;
  /** The x-axis type (drilling only advances a category axis by value). */
  xAxisType?: AxisType;
  /** The x-axis column name the filter is built against. */
  xAxisLabel: string;
  orientation?: OrientationType;
  dateFormat?: string;
  numberFormat?: string;
  /** Column type of the x-axis, used to format the breadcrumb label. */
  coltype?: GenericDataType;
}

/**
 * Build the drill-down filter(s) for a Timeseries-family chart click.
 *
 * Timeseries charts are always x-axis driven: the hierarchy advances along the
 * x-axis column and any groupby is only a series breakdown, so the drill filter
 * is always keyed to the clicked x-axis value — never the series dimension.
 * Clicks that are not on a series (e.g. axis labels, `componentType: 'xAxis'`)
 * return no filters so they never trigger a drill.
 *
 * The breadcrumb/cross-filter label uses `formatSeriesName` for parity with the
 * groupby drill path, so dates and decimals render formatted, not raw.
 */
export function buildTimeseriesDrillFilters({
  componentType,
  data,
  name,
  xAxisType,
  xAxisLabel,
  orientation,
  dateFormat,
  numberFormat,
  coltype,
}: TimeseriesDrillFilterParams): BinaryQueryObjectFilterClause[] {
  if (componentType !== 'series') {
    return [];
  }

  const format = (value: string | number) =>
    formatSeriesName(value, {
      timeFormatter: getTimeFormatter(dateFormat),
      numberFormatter: getNumberFormatter(numberFormat),
      coltype,
    });

  if (xAxisType === AxisType.Category) {
    const categoryAxisValue = getCategoryAxisValue(data, name, orientation);
    if (categoryAxisValue == null) {
      return [];
    }
    return [
      {
        col: xAxisLabel,
        op: '==',
        val: categoryAxisValue,
        formattedVal: format(categoryAxisValue),
      },
    ];
  }

  // Non-category (e.g. time) x-axis: use the event name. Null check so
  // zero-like labels (e.g. 0) still drill.
  if (name != null) {
    return [
      {
        col: xAxisLabel,
        op: '==',
        val: name as string | number,
        formattedVal: format(name as string | number),
      },
    ];
  }

  return [];
}
