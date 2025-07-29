/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
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
  ChartProps,
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getValueFormatter,
  NumberFormats,
  t,
  ValueFormatter,
  ChartDataResponseResult,
} from '@superset-ui/core';

// // Restoring the original, version-specific ECharts imports
// import type { EChartsCoreOption } from 'echarts/core';
// import type { PieSeriesOption } from 'echarts/charts';
// import type { CallbackDataParams } from 'echarts/types/src/util/types';

import type { EChartsOption } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import { LegendOrientation } from './types';

// type AnyParams = {
//   componentType?: string;
//   seriesType?: string;
//   seriesIndex?: number;
//   seriesName?: string;
//   name: string;
//   dataIndex?: number;
//   data: any;
//   value: any;
//   percent?: number; // ✅ Required for formatter and parseParams
//   color?: string;
//   [key: string]: any; // catch-all
// };

// type PieSeriesOption = NonNullable<EChartsOption['series']>[number]
type Series = NonNullable<EChartsOption['series']>;
type PieSeriesOption = Series extends Array<infer Item> ? Item : Series;

// Importing from your local, copied-over files
import {
  DEFAULT_FORM_DATA,
  DrilldownPieFormData,
  PieChartTransformedProps,
  EchartsPieLabelType,
  PieChartDataItem,
} from './types';
import { OpacityEnum } from './constants';
import {
  getContributionLabel,
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
} from './utils/series';
import { defaultGrid } from './defaults';
import { convertInteger } from './utils/convertInteger';

import type { Currency } from '@superset-ui/core';

import { LegendType } from '@superset-ui/plugin-chart-echarts';

function ensureIsCurrency(input: string | null | undefined): Currency {
  return (input ?? 'USD') as unknown as Currency;
}

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function parseParams({
  params,
  numberFormatter,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent'> & {
    [key: string]: any;
  };
  numberFormatter: ValueFormatter;
  sanitizeName?: boolean;
}): string[] {
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);
  return [name, formattedValue, formattedPercent];
}

function getTotalValuePadding({
  chartPadding,
  donut,
  width,
  height,
}: {
  chartPadding: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  donut: boolean;
  width: number;
  height: number;
}) {
  const padding: {
    left?: string;
    top?: string;
  } = {
    top: donut ? 'middle' : '0',
    left: 'center',
  };
  const LEGEND_HEIGHT = 15;
  const LEGEND_WIDTH = 215;
  if (chartPadding.top) {
    padding.top = donut
      ? `${50 + ((chartPadding.top - LEGEND_HEIGHT) / height / 2) * 100}%`
      : `${((chartPadding.top + LEGEND_HEIGHT) / height) * 100}%`;
  }
  if (chartPadding.bottom) {
    padding.top = donut
      ? `${50 - ((chartPadding.bottom + LEGEND_HEIGHT) / height / 2) * 100}%`
      : '0';
  }
  if (chartPadding.left) {
    padding.left = `${
      50 + ((chartPadding.left - LEGEND_WIDTH) / width / 2) * 100
    }%`;
  }
  if (chartPadding.right) {
    padding.left = `${
      50 - ((chartPadding.right + LEGEND_WIDTH) / width / 2) * 100
    }%`;
  }
  return padding;
}

export default function transformProps(
  chartProps: ChartProps<DrilldownPieFormData>,
): PieChartTransformedProps {
  const {
    width,
    height,
    queriesData,
    theme,
    filterState,
    datasource,
    formData,
  } = chartProps as ChartProps<DrilldownPieFormData> & {
    hooks: {
      setDataMask: (mask: any) => void;
    };
    behaviors: string[];
  };

  // // FIX #1: Use a type assertion to fix the formData error
  // const formData = chartProps.formData as DrilldownPieFormData;

  // Get formats from the datasource, or use empty objects as a fallback
  const { columnFormats = {}, currencyFormats = {} } = datasource;
  const { data: rawData = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(
    queriesData[0] as ChartDataResponseResult,
  );

  const {
    colorScheme,
    donut,
    groupby,
    innerRadius,
    labelsOutside,
    labelLine,
    labelType = '' as string,
    legendMargin = null as number | null,
    legendOrientation = '' as string,
    legendType: rawLegendType,
    metric = '' as string,
    numberFormat = '' as string,
    currencyFormat = '' as string,
    dateFormat = '' as string,
    outerRadius = 0 as number,
    showLabels = true,
    showLegend = true,
    showLabelsThreshold = 0 as number,
    sliceId = '' as string,
    showTotal = true,
    roseType = '' as string,
    label_template: labelTemplate = '' as string,
    threshold_for_other: thresholdForOther = 0 as number,
  } = { ...DEFAULT_FORM_DATA, ...formData };

  const legendType = rawLegendType as LegendType;

  const metricLabel = metric ? getMetricLabel(metric) : '';
  const contributionLabel = getContributionLabel(metricLabel);
  const groupbyLabels = groupby.map(getColumnLabel);
  const minShowLabelAngle = (showLabelsThreshold || 0) * 3.6;

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    numberFormat,
    ensureIsCurrency(currencyFormat),
  );

  let data = rawData;
  const otherRows: DataRecord[] = [];
  const otherTooltipData: string[][] = [];
  let otherDatum: PieChartDataItem | null = null;
  let otherSum = 0;
  if (thresholdForOther) {
    let contributionSum = 0;
    data = data.filter((datum: DataRecord) => {
      const contribution = datum[contributionLabel] as number;
      if (!contribution || contribution * 100 >= thresholdForOther) {
        return true;
      }
      otherSum += datum[metricLabel] as number;
      contributionSum += contribution;
      otherRows.push(datum);
      otherTooltipData.push([
        extractGroupbyLabel({
          datum,
          groupby: groupbyLabels,
          coltypeMapping,
          timeFormatter: getTimeFormatter(dateFormat),
        }),
        numberFormatter(datum[metricLabel] as number),
        percentFormatter(contribution),
      ]);
      return false;
    });
    const otherName = t('Other');
    otherTooltipData.push([
      t('Total'),
      numberFormatter(otherSum),
      percentFormatter(contributionSum),
    ]);
    if (otherSum) {
      otherDatum = {
        name: otherName,
        value: otherSum,
        itemStyle: {
          color: theme.colors.grayscale.dark1,
          opacity:
            filterState.selectedValues &&
            !filterState.selectedValues.includes(otherName)
              ? OpacityEnum.SemiTransparent
              : OpacityEnum.NonTransparent,
        },
        isOther: true,
      };
    }
  }

  // const labelMap = data.reduce((acc: Record<string, string[]>, datum: DataRecord) => {
  //     const label = extractGroupbyLabel({
  //       datum,
  //       groupby: groupbyLabels,
  //       coltypeMapping,
  //       timeFormatter: getTimeFormatter(dateFormat),
  //     });
  //     return {
  //       ...acc,
  //       [label]: groupbyLabels.map(col => datum[col] as string),
  //     };
  //   }, {});

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  let totalValue = 0;

  const transformedData: PieChartDataItem[] = data.map((datum: DataRecord) => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat),
    });

    const isFiltered =
      filterState.selectedValues && !filterState.selectedValues.includes(name);
    const value = datum[metricLabel];

    if (typeof value === 'number' || typeof value === 'string') {
      totalValue += convertInteger(value);
    }

    return {
      value,
      name,
      itemStyle: {
        color: colorFn(name, Number(sliceId)),
        opacity: isFiltered
          ? OpacityEnum.SemiTransparent
          : OpacityEnum.NonTransparent,
      },
    };
  });
  if (otherDatum) {
    transformedData.push(otherDatum);
    totalValue += otherSum;
  }

  // const selectedValues = (filterState.selectedValues || []).reduce(
  //   (acc: Record<string, number>, selectedValue: string) => {
  //     const index = transformedData.findIndex(
  //       ({ name }) => name === selectedValue,
  //     );
  //     return {
  //       ...acc,
  //       [index]: selectedValue,
  //     };
  //   },
  //   {},
  // );

  const formatTemplate = (
    template: string,
    formattedParams: {
      name: string;
      value: string;
      percent: string;
    },
    rawParams: CallbackDataParams,
  ) => {
    const items = {
      '{name}': formattedParams.name,
      '{value}': formattedParams.value,
      '{percent}': formattedParams.percent,
      '{a}': rawParams.seriesName || '',
      '{b}': rawParams.name,
      '{c}': `${rawParams.value}`,
      '{d}': `${rawParams.percent}`,
      '\\n': '\n',
    };

    return Object.entries(items).reduce(
      (acc, [key, value]) => acc.replaceAll(key, value),
      template,
    );
  };

  const formatter = (params: CallbackDataParams) => {
    const [name, formattedValue, formattedPercent] = parseParams({
      params,
      numberFormatter,
    });
    switch (labelType) {
      case EchartsPieLabelType.Key:
        return name;
      case EchartsPieLabelType.Value:
        return formattedValue;
      case EchartsPieLabelType.Percent:
        return formattedPercent;
      case EchartsPieLabelType.KeyValue:
        return `${name}: ${formattedValue}`;
      case EchartsPieLabelType.KeyValuePercent:
        return `${name}: ${formattedValue} (${formattedPercent})`;
      case EchartsPieLabelType.KeyPercent:
        return `${name}: ${formattedPercent}`;
      case EchartsPieLabelType.ValuePercent:
        return `${formattedValue} (${formattedPercent})`;
      case EchartsPieLabelType.Template:
        if (!labelTemplate) {
          return '';
        }
        return formatTemplate(
          labelTemplate,
          {
            name,
            value: formattedValue,
            percent: formattedPercent,
          },
          params,
        );
      default:
        return name;
    }
  };

  const defaultLabel = {
    formatter,
    show: showLabels ?? true,
    color: theme.colors.grayscale.dark2,
  };

  const legendOrientationEnum =
    (legendOrientation as LegendOrientation) ?? LegendOrientation.Top;

  const chartPadding = getChartPadding(
    showLegend ?? false,
    legendOrientationEnum,
    legendMargin,
  );

  const series: PieSeriesOption = {
    type: 'pie',
    ...chartPadding,
    animation: false,
    roseType:
      roseType === 'area' || roseType === 'radius' ? roseType : undefined,
    radius: [`${donut ? innerRadius : 0}%`, `${outerRadius}%`],
    center: ['50%', '50%'],
    avoidLabelOverlap: true,
    labelLine: labelsOutside && labelLine ? { show: true } : { show: false },
    minShowLabelAngle,
    label: {
      ...defaultLabel,
      position: labelsOutside ? 'outer' : 'inner',
      alignTo: labelsOutside ? 'none' : undefined,
      bleedMargin: labelsOutside ? 5 : undefined,
      formatter,
    },

    emphasis: {
      label: {
        show: true,
        fontWeight: 'bold',
        backgroundColor: theme.colors.grayscale.light5,
      },
    },
    data: transformedData,
  };

  const echartOptions: EChartsOption = {
    grid: {
      ...defaultGrid,
    },

    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const { name, value, percent } = params;
        // We can simplify the formatter logic as well, since parseParams and tooltipHtml also depend on refs

        return `${name}: ${numberFormatter(value)} (${percentFormatter(percent / 100)})`;
      },
    },
    // The fix is here: we remove the explicit `data` property. ECharts will now
    // generate the legend automatically from the series that is currently displayed.
    legend: getLegendProps(
      legendType,
      (legendOrientation as LegendOrientation) ?? LegendOrientation.Top,
      showLegend ?? false,
      theme,
    ) as NonNullable<EChartsOption['legend']>,

    graphic: showTotal
      ? {
          type: 'text',
          ...getTotalValuePadding({
            chartPadding,
            donut: donut ?? false,
            width,
            height,
          }),
          style: {
            text: t('Total: %s', numberFormatter(totalValue)),
            fontSize: 16,
            fontWeight: 'bold',
          },
          z: 10,
        }
      : undefined,
    series,
  };
  // // =================================================================
  // // DRILLDOWN CHANGE: We are adding new properties to be passed
  // // to the chart component.
  // // =================================================================
  // const drilldownData = {
  //   // Use the `groupbyLabels` constant which is already correctly processed
  //   // using the `getColumnLabel` utility.
  //   hierarchy: groupbyLabels,
  //   // The raw data from the query, which we will filter on the client side
  //   // when the user drills down.
  //   sourceData: rawData,
  //   // The metric we are measuring
  //   metric: metricLabel,
  // };
  // // =================================================================

  return {
    ...chartProps,

    // The props we've defined or transformed
    width,
    height,
    formData,
    echartOptions,

    // Add our new drilldown object to the props
    drilldownData: {
      sourceData: rawData, // Pass the raw data for client-side filtering
      hierarchy: groupby, // Pass the hierarchy definition
      metric: metricLabel, // Pass the metric name
    },

    // ✅ Ensure hooks are passed, including onContextMenu for DrillBy
    hooks: {
      ...(chartProps.hooks || {}),
      onContextMenu: chartProps.hooks?.onContextMenu,
    },
  };
}
