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
  ChartDataResponseResult,
  DataRecord,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  GenericDataType,
  NumberFormats,
  NumberFormatter,
  TimeFormatter,
  AxisType,
  SupersetTheme,
} from '@superset-ui/core';
import { format, LegendComponentOption, SeriesOption } from 'echarts';
import { sumBy, meanBy, minBy, maxBy, orderBy } from 'lodash';
import {
  StackControlsValue,
  NULL_STRING,
  TIMESERIES_CONSTANTS,
} from '../constants';
import {
  LegendOrientation,
  LegendType,
  SortSeriesType,
  StackType,
} from '../types';
import { defaultLegendPadding } from '../defaults';

function isDefined<T>(value: T | undefined | null): boolean {
  return value !== undefined && value !== null;
}

export function extractDataTotalValues(
  data: DataRecord[],
  opts: {
    stack: StackType;
    percentageThreshold: number;
    xAxisCol: string;
  },
): {
  totalStackedValues: number[];
  thresholdValues: number[];
} {
  const totalStackedValues: number[] = [];
  const thresholdValues: number[] = [];
  const { stack, percentageThreshold, xAxisCol } = opts;
  if (stack) {
    data.forEach(datum => {
      const values = Object.keys(datum).reduce((prev, curr) => {
        if (curr === xAxisCol) {
          return prev;
        }
        const value = datum[curr] || 0;
        return prev + (value as number);
      }, 0);
      totalStackedValues.push(values);
      thresholdValues.push(((percentageThreshold || 0) / 100) * values);
    });
  }
  return {
    totalStackedValues,
    thresholdValues,
  };
}

export function extractShowValueIndexes(
  series: SeriesOption[],
  opts: {
    stack: StackType;
    onlyTotal?: boolean;
    isHorizontal?: boolean;
  },
): number[] {
  const showValueIndexes: number[] = [];
  if (opts.stack) {
    series.forEach((entry, seriesIndex) => {
      const { data = [] } = entry;
      (data as [any, number][]).forEach((datum, dataIndex) => {
        if (!opts.onlyTotal && datum[opts.isHorizontal ? 0 : 1] !== null) {
          showValueIndexes[dataIndex] = seriesIndex;
        }
        if (opts.onlyTotal) {
          if (datum[opts.isHorizontal ? 0 : 1] > 0) {
            showValueIndexes[dataIndex] = seriesIndex;
          }
          if (
            !showValueIndexes[dataIndex] &&
            datum[opts.isHorizontal ? 0 : 1] !== null
          ) {
            showValueIndexes[dataIndex] = seriesIndex;
          }
        }
      });
    });
  }
  return showValueIndexes;
}

export function sortAndFilterSeries(
  rows: DataRecord[],
  xAxis: string,
  extraMetricLabels: any[],
  sortSeriesType?: SortSeriesType,
  sortSeriesAscending?: boolean,
): string[] {
  const seriesNames = Object.keys(rows[0])
    .filter(key => key !== xAxis)
    .filter(key => !extraMetricLabels.includes(key));

  let aggregator: (name: string) => { name: string; value: any };

  switch (sortSeriesType) {
    case SortSeriesType.Sum:
      aggregator = name => ({ name, value: sumBy(rows, name) });
      break;
    case SortSeriesType.Min:
      aggregator = name => ({ name, value: minBy(rows, name)?.[name] });
      break;
    case SortSeriesType.Max:
      aggregator = name => ({ name, value: maxBy(rows, name)?.[name] });
      break;
    case SortSeriesType.Avg:
      aggregator = name => ({ name, value: meanBy(rows, name) });
      break;
    default:
      aggregator = name => ({ name, value: name.toLowerCase() });
      break;
  }

  const sortedValues = seriesNames.map(aggregator);

  return orderBy(
    sortedValues,
    ['value'],
    [sortSeriesAscending ? 'asc' : 'desc'],
  ).map(({ name }) => name);
}

export function extractSeries(
  data: DataRecord[],
  opts: {
    fillNeighborValue?: number;
    xAxis?: string;
    extraMetricLabels?: string[];
    removeNulls?: boolean;
    stack?: StackType;
    totalStackedValues?: number[];
    isHorizontal?: boolean;
    sortSeriesType?: SortSeriesType;
    sortSeriesAscending?: boolean;
  } = {},
): SeriesOption[] {
  const {
    fillNeighborValue,
    xAxis = DTTM_ALIAS,
    extraMetricLabels = [],
    removeNulls = false,
    stack = false,
    totalStackedValues = [],
    isHorizontal = false,
    sortSeriesType,
    sortSeriesAscending,
  } = opts;
  if (data.length === 0) return [];
  const rows: DataRecord[] = data.map(datum => ({
    ...datum,
    [xAxis]: datum[xAxis],
  }));
  const series = sortAndFilterSeries(
    rows,
    xAxis,
    extraMetricLabels,
    sortSeriesType,
    sortSeriesAscending,
  );

  return series.map(name => ({
    id: name,
    name,
    data: rows
      .map((row, idx) => {
        const isNextToDefinedValue =
          isDefined(rows[idx - 1]?.[name]) || isDefined(rows[idx + 1]?.[name]);
        const isFillNeighborValue =
          !isDefined(row[name]) &&
          isNextToDefinedValue &&
          fillNeighborValue !== undefined;
        let value: DataRecordValue | undefined = row[name];
        if (isFillNeighborValue) {
          value = fillNeighborValue;
        } else if (
          stack === StackControlsValue.Expand &&
          totalStackedValues.length > 0
        ) {
          value = ((value || 0) as number) / totalStackedValues[idx];
        }
        return [row[xAxis], value];
      })
      .filter(obs => !removeNulls || (obs[0] !== null && obs[1] !== null))
      .map(obs => (isHorizontal ? [obs[1], obs[0]] : obs)),
  }));
}

export function formatSeriesName(
  name: DataRecordValue | undefined,
  {
    numberFormatter,
    timeFormatter,
    coltype,
  }: {
    numberFormatter?: NumberFormatter;
    timeFormatter?: TimeFormatter;
    coltype?: GenericDataType;
  } = {},
): string {
  if (name === undefined || name === null) {
    return NULL_STRING;
  }
  if (typeof name === 'boolean') {
    return name.toString();
  }
  if (name instanceof Date || coltype === GenericDataType.TEMPORAL) {
    const d = name instanceof Date ? name : new Date(name);

    return timeFormatter ? timeFormatter(d) : d.toISOString();
  }
  if (typeof name === 'number') {
    return numberFormatter ? numberFormatter(name) : name.toString();
  }
  return name;
}

export const getColtypesMapping = ({
  coltypes = [],
  colnames = [],
}: Pick<ChartDataResponseResult, 'coltypes' | 'colnames'>): Record<
  string,
  GenericDataType
> =>
  colnames.reduce(
    (accumulator, item, index) => ({ ...accumulator, [item]: coltypes[index] }),
    {},
  );

export function extractGroupbyLabel({
  datum = {},
  groupby,
  numberFormatter,
  timeFormatter,
  coltypeMapping = {},
}: {
  datum?: DataRecord;
  groupby?: string[] | null;
  numberFormatter?: NumberFormatter;
  timeFormatter?: TimeFormatter;
  coltypeMapping?: Record<string, GenericDataType>;
}): string {
  return ensureIsArray(groupby)
    .map(val =>
      formatSeriesName(datum[val], {
        numberFormatter,
        timeFormatter,
        ...(coltypeMapping[val] && { coltype: coltypeMapping[val] }),
      }),
    )
    .join(', ');
}

export function getLegendProps(
  type: LegendType,
  orientation: LegendOrientation,
  show: boolean,
  theme: SupersetTheme,
  zoomable = false,
): LegendComponentOption | LegendComponentOption[] {
  const legend: LegendComponentOption | LegendComponentOption[] = {
    orient: [LegendOrientation.Top, LegendOrientation.Bottom].includes(
      orientation,
    )
      ? 'horizontal'
      : 'vertical',
    show,
    type,
    selector: ['all', 'inverse'],
    selectorLabel: {
      fontFamily: theme.typography.families.sansSerif,
      fontSize: theme.typography.sizes.s,
      color: theme.colors.grayscale.base,
      borderColor: theme.colors.grayscale.base,
    },
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
  } else if (
    margin === null ||
    margin === undefined ||
    typeof margin === 'string'
  ) {
    legendMargin = defaultLegendPadding[orientation];
  } else {
    legendMargin = margin;
  }

  const { bottom = 0, left = 0, right = 0, top = 0 } = padding || {};
  return {
    left: left + (orientation === LegendOrientation.Left ? legendMargin : 0),
    right: right + (orientation === LegendOrientation.Right ? legendMargin : 0),
    top: top + (orientation === LegendOrientation.Top ? legendMargin : 0),
    bottom:
      bottom + (orientation === LegendOrientation.Bottom ? legendMargin : 0),
  };
}

export function dedupSeries(series: SeriesOption[]): SeriesOption[] {
  const counter = new Map<string, number>();
  return series.map(row => {
    let { id } = row;
    if (id === undefined) return row;
    id = String(id);
    const count = counter.get(id) || 0;
    const suffix = count > 0 ? ` (${count})` : '';
    counter.set(id, count + 1);
    return {
      ...row,
      id: `${id}${suffix}`,
    };
  });
}

export function sanitizeHtml(text: string): string {
  return format.encodeHTML(text);
}

// TODO: Better use other method to maintain this state
export const currentSeries = {
  name: '',
  legend: '',
};

export function getAxisType(dataType?: GenericDataType): AxisType {
  if (dataType === GenericDataType.TEMPORAL) {
    return AxisType.time;
  }
  return AxisType.category;
}

export function getOverMaxHiddenFormatter(
  config: {
    max?: number;
    formatter?: NumberFormatter;
  } = {},
) {
  const { max, formatter } = config;
  // Only apply this logic if there's a MAX set in the controls
  const shouldHideIfOverMax = !!max || max === 0;

  return new NumberFormatter({
    formatFunc: value =>
      `${
        shouldHideIfOverMax && value > max
          ? ''
          : formatter?.format(value) || value
      }`,
    id: NumberFormats.OVER_MAX_HIDDEN,
  });
}
