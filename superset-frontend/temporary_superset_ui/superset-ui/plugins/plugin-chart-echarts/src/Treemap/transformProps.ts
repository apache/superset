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
  DataRecord,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  NumberFormats,
  NumberFormatter,
} from '@superset-ui/core';
import { groupBy, isNumber, transform } from 'lodash';
import { TreemapSeriesNodeItemOption } from 'echarts/types/src/chart/treemap/TreemapSeries';
import { EChartsOption, TreemapSeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA as DEFAULT_TREEMAP_FORM_DATA,
  EchartsTreemapChartProps,
  EchartsTreemapFormData,
  EchartsTreemapLabelType,
  TreemapSeriesCallbackDataParams,
} from './types';
import { EchartsProps } from '../types';
import { formatSeriesName, getColtypesMapping } from '../utils/series';
import { defaultTooltip } from '../defaults';

export function formatLabel({
  params,
  labelType,
  numberFormatter,
}: {
  params: TreemapSeriesCallbackDataParams;
  labelType: EchartsTreemapLabelType;
  numberFormatter: NumberFormatter;
}): string {
  const { name = '', value } = params;
  const formattedValue = numberFormatter(value as number);

  switch (labelType) {
    case EchartsTreemapLabelType.Key:
      return name;
    case EchartsTreemapLabelType.Value:
      return formattedValue;
    case EchartsTreemapLabelType.KeyValue:
      return `${name}: ${formattedValue}`;
    default:
      return name;
  }
}

export function formatTooltip({
  params,
  numberFormatter,
}: {
  params: TreemapSeriesCallbackDataParams;
  numberFormatter: NumberFormatter;
}): string {
  const { value, treePathInfo = [] } = params;
  const formattedValue = numberFormatter(value as number);
  const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

  let formattedPercent = '';
  // the last item is current node, here we should find the parent node
  const currentNode = treePathInfo[treePathInfo.length - 1];
  const parentNode = treePathInfo[treePathInfo.length - 2];
  if (parentNode) {
    const percent: number = parentNode.value
      ? (currentNode.value as number) / (parentNode.value as number)
      : 0;
    formattedPercent = percentFormatter(percent);
  }

  const treePath = (treePathInfo ?? [])
    .map(pathInfo => pathInfo?.name || '')
    .filter(path => path !== '');
  // the 1st tree path is metric label
  const metricLabel = treePath.shift() || '';

  // groupby1/groupby2/...
  // metric: value (percent of parent)
  return [
    `<div>${treePath.join(' ▸ ')}</div>`,
    `${metricLabel}: ${formattedValue}`,
    formattedPercent ? ` (${formattedPercent})` : '',
  ].join('');
}

export default function transformProps(chartProps: EchartsTreemapChartProps): EchartsProps {
  const { formData, height, queriesData, width } = chartProps;
  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);

  const {
    colorScheme,
    groupby = [],
    metric = '',
    labelType,
    labelPosition,
    numberFormat,
    dateFormat,
    showLabels,
    showUpperLabels,
    dashboardId,
  }: EchartsTreemapFormData = {
    ...DEFAULT_TREEMAP_FORM_DATA,
    ...formData,
  };

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getNumberFormatter(numberFormat);
  const formatter = (params: TreemapSeriesCallbackDataParams) =>
    formatLabel({
      params,
      numberFormatter,
      labelType,
    });

  const transformer = (
    data: DataRecord[],
    groupbyData: string[],
    metric: string,
    depth: number,
  ): TreemapSeriesNodeItemOption[] => {
    const [currGroupby, ...restGroupby] = groupbyData;
    const currGrouping = groupBy(data, currGroupby);
    if (!restGroupby.length) {
      return transform(
        currGrouping,
        (result, value, key) => {
          (value ?? []).forEach(datum => {
            const name = formatSeriesName(key, {
              numberFormatter,
              timeFormatter: getTimeFormatter(dateFormat),
              ...(coltypeMapping[currGroupby] && { coltype: coltypeMapping[currGroupby] }),
            });
            result.push({
              name,
              value: isNumber(datum[metric]) ? (datum[metric] as number) : 0,
            });
          });
        },
        [] as TreemapSeriesNodeItemOption[],
      );
    }
    const sortedData = transform(
      currGrouping,
      (result, value, key) => {
        const name = formatSeriesName(key, {
          numberFormatter,
          timeFormatter: getTimeFormatter(dateFormat),
          ...(coltypeMapping[currGroupby] && { coltype: coltypeMapping[currGroupby] }),
        });
        const children = transformer(value, restGroupby, metric, depth + 1);
        result.push({
          name,
          children,
          value: children.reduce((prev, cur) => prev + (cur.value as number), 0),
        });
        result.sort((a, b) => (b.value as number) - (a.value as number));
      },
      [] as TreemapSeriesNodeItemOption[],
    );
    // sort according to the area and then take the color value in order
    return sortedData.map(child => ({
      ...child,
      colorSaturation: [0.4, 0.7],
      itemStyle: {
        borderColor: '#fff',
        color: colorFn(`${child.name}_${depth}`),
        borderWidth: 2,
        gapWidth: 2,
      },
    }));
  };

  const metricLabel = getMetricLabel(metric);
  const initialDepth = 1;
  const transformedData: TreemapSeriesNodeItemOption[] = [
    {
      name: metricLabel,
      colorSaturation: [0.4, 0.7],
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 2,
        gapWidth: 2,
      },
      upperLabel: {
        show: false,
      },
      children: transformer(data, groupby, metricLabel, initialDepth),
    },
  ];

  // set a default color when metric values are 0 over all.
  const levels = [
    {
      upperLabel: {
        show: false,
      },
      label: {
        show: false,
      },
      itemStyle: {
        color: CategoricalColorNamespace.getColor(),
      },
    },
  ];

  const series: TreemapSeriesOption[] = [
    {
      type: 'treemap',
      animation: false,
      width: '100%',
      height: '100%',
      nodeClick: dashboardId ? undefined : 'zoomToNode',
      roam: !dashboardId,
      breadcrumb: {
        show: false,
        emptyItemWidth: 25,
      },
      squareRatio: 0.5 * (1 + Math.sqrt(5)), // golden ratio
      emphasis: {
        label: {
          show: true,
        },
      },
      levels,
      label: {
        show: showLabels,
        position: labelPosition,
        formatter,
        color: '#000',
        fontSize: 11,
      },
      upperLabel: {
        show: showUpperLabels,
        formatter,
        textBorderColor: 'transparent',
        fontSize: 11,
      },
      data: transformedData,
    },
  ];

  const echartOptions: EChartsOption = {
    tooltip: {
      ...defaultTooltip,
      trigger: 'item',
      formatter: (params: any) =>
        formatTooltip({
          params,
          numberFormatter,
        }),
    },
    series,
  };

  return {
    width,
    height,
    echartOptions,
  };
}
