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
  CategoricalColorNamespace,
  DataRecordValue,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
} from '@superset-ui/core';
import { EChartsCoreOption, BoxplotSeriesOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  BoxPlotChartTransformedProps,
  BoxPlotQueryFormData,
  EchartsBoxPlotChartProps,
} from './types';
import {
  extractGroupbyLabel,
  getColtypesMapping,
  sanitizeHtml,
} from '../utils/series';
import { convertInteger } from '../utils/convertInteger';
import { defaultGrid, defaultTooltip, defaultYAxis } from '../defaults';
import { getPadding } from '../Timeseries/transformers';
import { OpacityEnum } from '../constants';

export default function transformProps(
  chartProps: EchartsBoxPlotChartProps,
): BoxPlotChartTransformedProps {
  const { width, height, formData, hooks, filterState, queriesData } =
    chartProps;
  const { data = [] } = queriesData[0];
  const { setDataMask = () => {} } = hooks;
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const {
    colorScheme,
    groupby = [],
    metrics = [],
    numberFormat,
    dateFormat,
    xTicksLayout,
    emitFilter,
    legendOrientation = 'top',
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
    sliceId,
  } = formData as BoxPlotQueryFormData;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getNumberFormatter(numberFormat);
  const metricLabels = metrics.map(getMetricLabel);
  const groupbyLabels = groupby.map(getColumnLabel);

  const transformedData = data
    .map((datum: any) => {
      const groupbyLabel = extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping,
        timeFormatter: getTimeFormatter(dateFormat),
      });
      return metricLabels.map(metric => {
        const name =
          metricLabels.length === 1
            ? groupbyLabel
            : `${groupbyLabel}, ${metric}`;
        const isFiltered =
          filterState.selectedValues &&
          !filterState.selectedValues.includes(name);
        return {
          name,
          value: [
            datum[`${metric}__min`],
            datum[`${metric}__q1`],
            datum[`${metric}__median`],
            datum[`${metric}__q3`],
            datum[`${metric}__max`],
            datum[`${metric}__mean`],
            datum[`${metric}__count`],
            datum[`${metric}__outliers`],
          ],
          itemStyle: {
            color: colorFn(groupbyLabel, sliceId),
            opacity: isFiltered ? OpacityEnum.SemiTransparent : 0.6,
            borderColor: colorFn(groupbyLabel, sliceId),
          },
        };
      });
    })
    .flatMap(row => row);
  const outlierData = data
    .map(datum =>
      metricLabels.map(metric => {
        const groupbyLabel = extractGroupbyLabel({
          datum,
          groupby: groupbyLabels,
          coltypeMapping,
          timeFormatter: getTimeFormatter(dateFormat),
        });
        const name =
          metricLabels.length === 1
            ? groupbyLabel
            : `${groupbyLabel}, ${metric}`;
        // Outlier data is a nested array of numbers (uncommon, therefore no need to add to DataRecordValue)
        const outlierDatum = (datum[`${metric}__outliers`] || []) as number[];
        const isFiltered =
          filterState.selectedValues &&
          !filterState.selectedValues.includes(name);
        return {
          name: 'outlier',
          type: 'scatter',
          data: outlierDatum.map(val => [name, val]),
          tooltip: {
            formatter: (param: { data: [string, number] }) => {
              const [outlierName, stats] = param.data;
              const headline = groupbyLabels.length
                ? `<p><strong>${sanitizeHtml(outlierName)}</strong></p>`
                : '';
              return `${headline}${numberFormatter(stats)}`;
            },
          },
          itemStyle: {
            color: colorFn(groupbyLabel, sliceId),
            opacity: isFiltered
              ? OpacityEnum.SemiTransparent
              : OpacityEnum.NonTransparent,
          },
        };
      }),
    )
    .flat(2);

  const labelMap = data.reduce(
    (acc: Record<string, DataRecordValue[]>, datum) => {
      const label = extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping,
        timeFormatter: getTimeFormatter(dateFormat),
      });
      return {
        ...acc,
        [label]: groupbyLabels.map(col => datum[col]),
      };
    },
    {},
  );

  const selectedValues = (filterState.selectedValues || []).reduce(
    (acc: Record<string, number>, selectedValue: string) => {
      const index = transformedData.findIndex(
        ({ name }) => name === selectedValue,
      );
      return {
        ...acc,
        [index]: selectedValue,
      };
    },
    {},
  );

  let axisLabel;
  if (xTicksLayout === '45°') axisLabel = { rotate: -45 };
  else if (xTicksLayout === '90°') axisLabel = { rotate: -90 };
  else if (xTicksLayout === 'flat') axisLabel = { rotate: 0 };
  else if (xTicksLayout === 'staggered') axisLabel = { rotate: -45 };
  else axisLabel = { show: true };

  const series: BoxplotSeriesOption[] = [
    {
      name: 'boxplot',
      type: 'boxplot',
      data: transformedData,
      tooltip: {
        formatter: (param: CallbackDataParams) => {
          // @ts-ignore
          const {
            value,
            name,
          }: {
            value: [
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number[],
            ];
            name: string;
          } = param;
          const headline = name
            ? `<p><strong>${sanitizeHtml(name)}</strong></p>`
            : '';
          const stats = [
            `Max: ${numberFormatter(value[5])}`,
            `3rd Quartile: ${numberFormatter(value[4])}`,
            `Mean: ${numberFormatter(value[6])}`,
            `Median: ${numberFormatter(value[3])}`,
            `1st Quartile: ${numberFormatter(value[2])}`,
            `Min: ${numberFormatter(value[1])}`,
            `# Observations: ${numberFormatter(value[7])}`,
          ];
          if (value[8].length > 0) {
            stats.push(`# Outliers: ${numberFormatter(value[8].length)}`);
          }
          return headline + stats.join('<br/>');
        },
      },
    },
    // @ts-ignore
    ...outlierData,
  ];
  const addYAxisTitleOffset = !!yAxisTitle;
  const addXAxisTitleOffset = !!xAxisTitle;
  const chartPadding = getPadding(
    true,
    legendOrientation,
    addYAxisTitleOffset,
    false,
    null,
    addXAxisTitleOffset,
    yAxisTitlePosition,
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );
  const echartOptions: EChartsCoreOption = {
    grid: {
      ...defaultGrid,
      ...chartPadding,
    },
    xAxis: {
      type: 'category',
      data: transformedData.map(row => row.name),
      axisLabel,
      name: xAxisTitle,
      nameGap: convertInteger(xAxisTitleMargin),
      nameLocation: 'middle',
    },
    yAxis: {
      ...defaultYAxis,
      type: 'value',
      axisLabel: { formatter: numberFormatter },
      name: yAxisTitle,
      nameGap: convertInteger(yAxisTitleMargin),
      nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
    },
    tooltip: {
      ...defaultTooltip,
      trigger: 'item',
      axisPointer: {
        type: 'shadow',
      },
    },
    series,
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitFilter,
    labelMap,
    groupby,
    selectedValues,
  };
}
