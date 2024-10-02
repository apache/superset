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
import type { ComposeOption } from 'echarts/core';
import type { SankeySeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  CategoricalColorNamespace,
  NumberFormats,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { SankeyChartProps, SankeyTransformedProps } from './types';
import { Refs } from '../types';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';

type Link = { source: string; target: string; value: number };
type EChartsOption = ComposeOption<SankeySeriesOption>;

export default function transformProps(
  chartProps: SankeyChartProps,
): SankeyTransformedProps {
  const refs: Refs = {};
  const { formData, height, hooks, queriesData, width } = chartProps;
  const { onLegendStateChanged } = hooks;
  const { colorScheme, metric, source, target } = formData;
  const { data } = queriesData[0];
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const metricLabel = getMetricLabel(metric);
  const valueFormatter = getNumberFormatter(NumberFormats.FLOAT_2_POINT);
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);

  const links: Link[] = [];
  const set = new Set<string>();
  data.forEach(datum => {
    const sourceName = String(datum[getColumnLabel(source)]);
    const targetName = String(datum[getColumnLabel(target)]);
    const value = datum[metricLabel] as number;
    set.add(sourceName);
    set.add(targetName);
    links.push({
      source: sourceName,
      target: targetName,
      value,
    });
  });

  const seriesData: NonNullable<SankeySeriesOption['data']> = Array.from(
    set,
  ).map(name => ({
    name,
    itemStyle: {
      color: colorFn(name),
    },
  }));

  // stores a map with the total values for each node considering the links
  const nodeValues = new Map<string, number>();
  links.forEach(link => {
    const { source, target, value } = link;
    const sourceValue = nodeValues.get(source) || 0;
    const targetValue = nodeValues.get(target) || 0;
    nodeValues.set(source, sourceValue + value);
    nodeValues.set(target, targetValue + value);
  });

  const tooltipFormatter = (params: CallbackDataParams) => {
    const { name, data } = params;
    const value = params.value as number;
    const rows = [[metricLabel, valueFormatter.format(value)]];
    const { source, target } = data as Link;
    if (source && target) {
      rows.push([
        `% (${source})`,
        percentFormatter.format(value / nodeValues.get(source)!),
      ]);
      rows.push([
        `% (${target})`,
        percentFormatter.format(value / nodeValues.get(target)!),
      ]);
    }
    return tooltipHtml(rows, name);
  };

  const echartOptions: EChartsOption = {
    series: {
      animation: false,
      data: seriesData,
      lineStyle: {
        color: 'source',
      },
      links,
      type: 'sankey',
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      formatter: tooltipFormatter,
    },
  };

  return {
    refs,
    formData,
    width,
    height,
    echartOptions,
    onLegendStateChanged,
  };
}
