/* eslint-disable no-underscore-dangle */
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
  DataRecord,
  DataRecordValue,
  NumberFormatter,
  TimeFormatter,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import { LegendComponentOption, SeriesOption } from 'echarts';
import { NULL_STRING, TIMESERIES_CONSTANTS } from '../constants';
import { LegendOrientation, LegendType } from '../types';
import { defaultLegendPadding } from '../defaults';

export function extractTimeseriesSeries(data: TimeseriesDataRecord[]): SeriesOption[] {
  if (data.length === 0) return [];
  const rows = data.map(datum => ({
    ...datum,
    __timestamp: datum.__timestamp || datum.__timestamp === 0 ? new Date(datum.__timestamp) : null,
  }));

  return Object.keys(rows[0])
    .filter(key => key !== '__timestamp')
    .map(key => ({
      id: key,
      name: key,
      data: rows.map((datum: { [p: string]: DataRecordValue; __timestamp: Date | null }) => [
        datum.__timestamp,
        datum[key],
      ]),
    }));
}

export function formatSeriesName(
  name: DataRecordValue | undefined,
  {
    numberFormatter,
    timeFormatter,
  }: {
    numberFormatter?: NumberFormatter;
    timeFormatter?: TimeFormatter;
  } = {},
): string {
  if (name === undefined || name === null) {
    return NULL_STRING;
  }
  if (typeof name === 'number') {
    return numberFormatter ? numberFormatter(name) : name.toString();
  }
  if (typeof name === 'boolean') {
    return name.toString();
  }
  if (name instanceof Date) {
    return timeFormatter ? timeFormatter(name) : name.toISOString();
  }
  return name;
}

export function extractGroupbyLabel({
  datum = {},
  groupby,
  numberFormatter,
  timeFormatter,
}: {
  datum?: DataRecord;
  groupby?: string[] | null;
  numberFormatter?: NumberFormatter;
  timeFormatter?: TimeFormatter;
}): string {
  return (groupby || [])
    .map(val => formatSeriesName(datum[val], { numberFormatter, timeFormatter }))
    .join(', ');
}

export function getLegendProps(
  type: LegendType,
  orientation: LegendOrientation,
  show: boolean,
  zoomable = false,
): LegendComponentOption | LegendComponentOption[] {
  const legend: LegendComponentOption | LegendComponentOption[] = {
    orient: [LegendOrientation.Top, LegendOrientation.Bottom].includes(orientation)
      ? 'horizontal'
      : 'vertical',
    show,
    type,
  };
  switch (orientation) {
    case LegendOrientation.Left:
      legend.left = 0;
      break;
    case LegendOrientation.Right:
      legend.right = 0;
      legend.top = zoomable ? TIMESERIES_CONSTANTS.legendRightTopOffset : 0;
      break;
    case LegendOrientation.Bottom:
      legend.bottom = 0;
      break;
    case LegendOrientation.Top:
    default:
      legend.top = 0;
      legend.right = zoomable ? TIMESERIES_CONSTANTS.legendTopRightOffset : 0;
      break;
  }
  return legend;
}

export function getChartPadding(
  show: boolean,
  orientation: LegendOrientation,
  margin?: string | number | null,
  padding?: { top?: number; bottom?: number; left?: number; right?: number },
): {
  bottom: number;
  left: number;
  right: number;
  top: number;
} {
  let legendMargin;
  if (!show) {
    legendMargin = 0;
  } else if (margin === null || margin === undefined || typeof margin === 'string') {
    legendMargin = defaultLegendPadding[orientation];
  } else {
    legendMargin = margin;
  }

  const { bottom = 0, left = 0, right = 0, top = 0 } = padding || {};
  return {
    left: left + (orientation === LegendOrientation.Left ? legendMargin : 0),
    right: right + (orientation === LegendOrientation.Right ? legendMargin : 0),
    top: top + (orientation === LegendOrientation.Top ? legendMargin : 0),
    bottom: bottom + (orientation === LegendOrientation.Bottom ? legendMargin : 0),
  };
}
