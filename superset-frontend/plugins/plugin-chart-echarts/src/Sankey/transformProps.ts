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
  getSankeyHighlight,
  getSelectedSankeyKeys,
  sankeyEndpointKey,
  SankeyFilterColumn,
  SankeyLinkDatum,
  sankeyNodeName,
  sankeyValueId,
} from './crossFilter';

/**
 * ECharts draws an unselected Sankey link at opacity 0.2. A selection has to
 * raise the matching links above that and drop the others below it.
 */
export const SELECTED_LINK_OPACITY = 0.8;
export const DIMMED_LINK_OPACITY = 0.06;

type NodeMeta = {
  filterColumn: SankeyFilterColumn;
  value: DataRecordValue;
  displayName: string;
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
  // One ECharts node per value id. The same id in both columns keeps the
  // column of the first row that introduced it.
  const nodes = new Map<string, NodeMeta>();
  const rememberNode = (column: SankeyFilterColumn, raw: DataRecordValue) => {
    const name = sankeyValueId(raw);
    if (!nodes.has(name)) {
      nodes.set(name, {
        filterColumn: column,
        value: raw,
        displayName: sankeyNodeName(raw),
      });
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

  const highlight = getSankeyHighlight(selectedKeys, links);
  const seriesData = Array.from(nodes.entries()).map(([name, meta]) => ({
    name,
    displayName: meta.displayName,
    filterColumn: meta.filterColumn,
    rawValue: meta.value,
    itemStyle: {
      color: colorFn(meta.displayName, sliceId),
      ...(highlight &&
        !highlight.nodeIds.has(name) && {
          opacity: OpacityEnum.SemiTransparent,
        }),
    },
    label: {
      formatter: () => meta.displayName,
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
    const sourceName = nodes.get(linkSource)?.displayName;
    const targetName = nodes.get(linkTarget)?.displayName;
    if (sourceName && targetName) {
      rows.push([
        `% (${sourceName})`,
        percentFormatter.format(value / nodeValues.get(linkSource)!),
      ]);
      rows.push([
        `% (${targetName})`,
        percentFormatter.format(value / nodeValues.get(linkTarget)!),
      ]);
      return tooltipHtml(rows, `${sourceName} → ${targetName}`);
    }
    return tooltipHtml(rows, nodes.get(name)?.displayName ?? name);
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
        ...(highlight && {
          lineStyle: {
            color: 'source' as const,
            opacity: highlight.linkKeys.has(
              sankeyEndpointKey(link.source, link.target),
            )
              ? SELECTED_LINK_OPACITY
              : DIMMED_LINK_OPACITY,
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
