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
  ChartProps,
  getMetricLabel,
  DataRecord,
  DataRecordValue,
} from '@superset-ui/core';
import { EChartsCoreOption, GraphSeriesOption } from 'echarts';
import { extent as d3Extent } from 'd3-array';
import { GraphEdgeItemOption } from 'echarts/types/src/chart/graph/GraphSeries';
import {
  EchartsGraphFormData,
  EChartGraphNode,
  DEFAULT_FORM_DATA as DEFAULT_GRAPH_FORM_DATA,
  EdgeSymbol,
} from './types';
import { DEFAULT_GRAPH_SERIES_OPTION } from './constants';
import { EchartsProps } from '../types';
import { getChartPadding, getLegendProps, sanitizeHtml } from '../utils/series';

type EdgeWithStyles = GraphEdgeItemOption & {
  lineStyle: Exclude<GraphEdgeItemOption['lineStyle'], undefined>;
  emphasis: Exclude<GraphEdgeItemOption['emphasis'], undefined>;
  select: Exclude<GraphEdgeItemOption['select'], undefined>;
};

function verifyEdgeSymbol(symbol: string): EdgeSymbol {
  if (symbol === 'none' || symbol === 'circle' || symbol === 'arrow') {
    return symbol;
  }
  return 'none';
}

function parseEdgeSymbol(symbols?: string | null): [EdgeSymbol, EdgeSymbol] {
  const [start, end] = (symbols || '').split(',');
  return [verifyEdgeSymbol(start), verifyEdgeSymbol(end)];
}

/**
 * Emphasized edge width with a min and max.
 */
function getEmphasizedEdgeWidth(width: number) {
  return Math.max(5, Math.min(width * 2, 20));
}

/**
 * Normalize node size, edge width, and apply label visibility thresholds.
 */
function normalizeStyles(
  nodes: EChartGraphNode[],
  links: EdgeWithStyles[],
  {
    baseNodeSize,
    baseEdgeWidth,
    showSymbolThreshold,
  }: {
    baseNodeSize: number;
    baseEdgeWidth: number;
    showSymbolThreshold?: number;
  },
) {
  const minNodeSize = baseNodeSize * 0.5;
  const maxNodeSize = baseNodeSize * 2;
  const minEdgeWidth = baseEdgeWidth * 0.5;
  const maxEdgeWidth = baseEdgeWidth * 2;
  const [nodeMinValue, nodeMaxValue] = d3Extent(nodes, x => x.value) as [
    number,
    number,
  ];

  const nodeSpread = nodeMaxValue - nodeMinValue;
  nodes.forEach(node => {
    // eslint-disable-next-line no-param-reassign
    node.symbolSize =
      (((node.value - nodeMinValue) / nodeSpread) * maxNodeSize || 0) +
      minNodeSize;
    // eslint-disable-next-line no-param-reassign
    node.label = {
      ...node.label,
      show: showSymbolThreshold ? node.value > showSymbolThreshold : true,
    };
  });

  const [linkMinValue, linkMaxValue] = d3Extent(links, x => x.value) as [
    number,
    number,
  ];
  const linkSpread = linkMaxValue - linkMinValue;
  links.forEach(link => {
    const lineWidth =
      ((link.value! - linkMinValue) / linkSpread) * maxEdgeWidth ||
      0 + minEdgeWidth;
    // eslint-disable-next-line no-param-reassign
    link.lineStyle.width = lineWidth;
    // eslint-disable-next-line no-param-reassign
    link.emphasis.lineStyle = {
      ...link.emphasis.lineStyle,
      width: getEmphasizedEdgeWidth(lineWidth),
    };
    // eslint-disable-next-line no-param-reassign
    link.select.lineStyle = {
      ...link.select.lineStyle,
      width: getEmphasizedEdgeWidth(lineWidth * 0.8),
      opacity: 1,
    };
  });
}

function getKeyByValue(
  object: { [name: string]: number },
  value: number,
): string {
  return Object.keys(object).find(key => object[key] === value) as string;
}

function edgeFormatter(
  sourceIndex: string,
  targetIndex: string,
  value: number,
  nodes: { [name: string]: number },
): string {
  const source = Number(sourceIndex);
  const target = Number(targetIndex);
  return `${sanitizeHtml(getKeyByValue(nodes, source))} > ${sanitizeHtml(
    getKeyByValue(nodes, target),
  )} : ${value}`;
}

function getCategoryName(columnName: string, name?: DataRecordValue) {
  if (name === false) {
    return `${columnName}: false`;
  }
  if (name === true) {
    return `${columnName}: true`;
  }
  if (name == null) {
    return 'N/A';
  }
  return String(name);
}

export default function transformProps(chartProps: ChartProps): EchartsProps {
  const { width, height, formData, queriesData } = chartProps;
  const data: DataRecord[] = queriesData[0].data || [];

  const {
    source,
    target,
    sourceCategory,
    targetCategory,
    colorScheme,
    metric = '',
    layout,
    roam,
    draggable,
    selectedMode,
    showSymbolThreshold,
    edgeLength,
    gravity,
    repulsion,
    friction,
    legendMargin,
    legendOrientation,
    legendType,
    showLegend,
    baseEdgeWidth,
    baseNodeSize,
    edgeSymbol,
  }: EchartsGraphFormData = { ...DEFAULT_GRAPH_FORM_DATA, ...formData };

  const metricLabel = getMetricLabel(metric);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const nodes: { [name: string]: number } = {};
  const categories: Set<string> = new Set();
  const echartNodes: EChartGraphNode[] = [];
  const echartLinks: EdgeWithStyles[] = [];

  /**
   * Get the node id of an existing node,
   * or create a new node if it doesn't exist.
   */
  function getOrCreateNode(name: string, category?: string) {
    if (!(name in nodes)) {
      nodes[name] = echartNodes.length;
      echartNodes.push({
        id: String(nodes[name]),
        name,
        value: 0,
        category,
        select: DEFAULT_GRAPH_SERIES_OPTION.select,
        tooltip: DEFAULT_GRAPH_SERIES_OPTION.tooltip,
      });
    }
    const node = echartNodes[nodes[name]];
    if (category) {
      categories.add(category);
      // category may be empty when one of `sourceCategory`
      // or `targetCategory` is not set.
      if (!node.category) {
        node.category = category;
      }
    }
    return node;
  }

  data.forEach(link => {
    const value = link[metricLabel] as number;
    if (!value) {
      return;
    }
    const sourceName = link[source] as string;
    const targetName = link[target] as string;
    const sourceCategoryName = sourceCategory
      ? getCategoryName(sourceCategory, link[sourceCategory])
      : undefined;
    const targetCategoryName = targetCategory
      ? getCategoryName(targetCategory, link[targetCategory])
      : undefined;
    const sourceNode = getOrCreateNode(sourceName, sourceCategoryName);
    const targetNode = getOrCreateNode(targetName, targetCategoryName);

    sourceNode.value += value;
    targetNode.value += value;

    echartLinks.push({
      source: sourceNode.id,
      target: targetNode.id,
      value,
      lineStyle: {},
      emphasis: {},
      select: {},
    });
  });

  normalizeStyles(echartNodes, echartLinks, {
    showSymbolThreshold,
    baseEdgeWidth,
    baseNodeSize,
  });

  const categoryList = [...categories];

  const series: GraphSeriesOption[] = [
    {
      zoom: DEFAULT_GRAPH_SERIES_OPTION.zoom,
      type: 'graph',
      categories: categoryList.map(c => ({
        name: c,
        itemStyle: { color: colorFn(c) },
      })),
      layout,
      force: {
        ...DEFAULT_GRAPH_SERIES_OPTION.force,
        edgeLength,
        gravity,
        repulsion,
        friction,
      },
      circular: DEFAULT_GRAPH_SERIES_OPTION.circular,
      data: echartNodes,
      links: echartLinks,
      roam,
      draggable,
      edgeSymbol: parseEdgeSymbol(edgeSymbol),
      edgeSymbolSize: baseEdgeWidth * 2,
      selectedMode,
      ...getChartPadding(showLegend, legendOrientation, legendMargin),
      animation: DEFAULT_GRAPH_SERIES_OPTION.animation,
      label: DEFAULT_GRAPH_SERIES_OPTION.label,
      lineStyle: DEFAULT_GRAPH_SERIES_OPTION.lineStyle,
      emphasis: DEFAULT_GRAPH_SERIES_OPTION.emphasis,
    },
  ];

  const echartOptions: EChartsCoreOption = {
    animationDuration: DEFAULT_GRAPH_SERIES_OPTION.animationDuration,
    animationEasing: DEFAULT_GRAPH_SERIES_OPTION.animationEasing,
    tooltip: {
      formatter: (params: any): string =>
        edgeFormatter(
          params.data.source,
          params.data.target,
          params.value,
          nodes,
        ),
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend),
      data: categoryList,
    },
    series,
  };
  return {
    width,
    height,
    echartOptions,
  };
}
