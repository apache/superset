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
  DataRecordValue,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  NumberFormats,
  tooltipHtml,
} from '@superset-ui/core';
import { SankeyChartProps, SankeyTransformedProps } from './types';
import { Refs } from '../types';
import { OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';
import { getColtypesMapping } from '../utils/series';
import {
  isSankeyLinkDimmed,
  isSankeyNodeDimmed,
  SankeyFilterColumn,
  SankeyLinkDatum,
  sankeyNodeName,
  getSelectedSankeyKeys,
} from './crossFilter';

type NodeMeta = {
  filterColumn: SankeyFilterColumn;
  value: DataRecordValue;
};

type EChartsOption = ComposeOption<SankeySeriesOption>;

export default function transformProps(
  chartProps: SankeyChartProps,
): SankeyTransformedProps {
  const refs: Refs = {};
  const {
    formData,
    height,
    hooks,
    queriesData,
    width,
    theme,
    filterState,
    emitCrossFilters,
  } = chartProps;
  const { onContextMenu, onLegendStateChanged, setDataMask } = hooks;
  const { colorScheme, metric, source, target, sliceId } = formData;
  const { data } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const metricLabel = getMetricLabel(metric);
  const sourceLabel = getColumnLabel(source);
  const targetLabel = getColumnLabel(target);
  const valueFormatter = getNumberFormatter(NumberFormats.FLOAT_2_POINT);
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);
  const selectedKeys = getSelectedSankeyKeys(filterState?.selectedValues);

  const links: SankeyLinkDatum[] = [];
  // One ECharts node per label. A label that appears in both columns keeps
  // the column of the first row that introduced it.
  const nodes = new Map<string, NodeMeta>();
  const rememberNode = (column: SankeyFilterColumn, raw: DataRecordValue) => {
    const name = sankeyNodeName(raw);
    if (!nodes.has(name)) {
      nodes.set(name, { filterColumn: column, value: raw });
    }
    return name;
  };

  data.forEach(datum => {
    const sourceName = rememberNode('source', datum[sourceLabel]);
    const targetName = rememberNode('target', datum[targetLabel]);
    links.push({
      source: sourceName,
      target: targetName,
      value: datum[metricLabel] as number,
      sourceValue: datum[sourceLabel],
      targetValue: datum[targetLabel],
    });
  });

  const seriesData = Array.from(nodes.entries()).map(([name, meta]) => ({
    name,
    filterColumn: meta.filterColumn,
    rawValue: meta.value,
    itemStyle: {
      color: colorFn(name, sliceId),
      ...(isSankeyNodeDimmed(name, selectedKeys, links) && {
        opacity: OpacityEnum.SemiTransparent,
      }),
    },
    label: {
      color: theme.colorText,
      textShadow: theme.colorBgBase,
    },
  }));

  const incomingFlows = new Map<string, number>();
  const outgoingFlows = new Map<string, number>();
  const allNodeNames = new Set<string>();

  links.forEach(link => {
    const { source: linkSource, target: linkTarget, value } = link;
    allNodeNames.add(linkSource);
    allNodeNames.add(linkTarget);
    incomingFlows.set(linkTarget, (incomingFlows.get(linkTarget) || 0) + value);
    outgoingFlows.set(linkSource, (outgoingFlows.get(linkSource) || 0) + value);
  });

  const nodeValues = new Map<string, number>();

  allNodeNames.forEach(nodeName => {
    const totalIncoming = incomingFlows.get(nodeName) || 0;
    const totalOutgoing = outgoingFlows.get(nodeName) || 0;

    nodeValues.set(nodeName, Math.max(totalIncoming, totalOutgoing));
  });

  const tooltipFormatter = (params: CallbackDataParams) => {
    const { name, data: tooltipData } = params;
    const value = params.value as number;
    const rows = [[metricLabel, valueFormatter.format(value)]];
    const { source: linkSource, target: linkTarget } =
      tooltipData as SankeyLinkDatum;
    if (linkSource && linkTarget) {
      rows.push([
        `% (${linkSource})`,
        percentFormatter.format(value / nodeValues.get(linkSource)!),
      ]);
      rows.push([
        `% (${linkTarget})`,
        percentFormatter.format(value / nodeValues.get(linkTarget)!),
      ]);
    }
    return tooltipHtml(rows, name);
  };

  const echartOptions: EChartsOption = {
    series: {
      animation: false,
      cursor: emitCrossFilters ? 'pointer' : 'default',
      data: seriesData,
      lineStyle: {
        color: 'source',
      },
      links: links.map(link => ({
        ...link,
        ...(isSankeyLinkDimmed(link, selectedKeys) && {
          lineStyle: {
            color: 'source' as const,
            opacity: OpacityEnum.SemiTransparent,
          },
        }),
      })),
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
    onContextMenu,
    onLegendStateChanged,
    setDataMask,
    filterState,
    emitCrossFilters,
    coltypeMapping,
  };
}
