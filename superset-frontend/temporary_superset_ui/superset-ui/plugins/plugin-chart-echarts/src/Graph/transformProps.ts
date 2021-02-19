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
import { EChartsOption, GraphSeriesOption } from 'echarts';
import { extent as d3Extent } from 'd3-array';
import { GraphEdgeItemOption } from 'echarts/types/src/chart/graph/GraphSeries';
import {
  EchartsGraphFormData,
  EChartGraphNode,
  DEFAULT_FORM_DATA as DEFAULT_GRAPH_FORM_DATA,
} from './types';
import { DEFAULT_GRAPH_SERIES_OPTION, NORMALIZATION_LIMITS } from './constants';
import { EchartsProps } from '../types';
import { getChartPadding, getLegendProps } from '../utils/series';

/**
 * Normalize node size, edge width, and apply label visibility thresholds.
 */
function normalizeStyles(
  nodes: EChartGraphNode[],
  links: GraphEdgeItemOption[],
  {
    showSymbolThreshold,
  }: {
    showSymbolThreshold?: number;
  },
) {
  const [nodeMinValue, nodeMaxValue] = d3Extent(nodes, x => x.value) as [number, number];
  const nodeSpread = nodeMaxValue - nodeMinValue;
  nodes.forEach(node => {
    // eslint-disable-next-line no-param-reassign
    node.symbolSize =
      (((node.value - nodeMinValue) / nodeSpread) * NORMALIZATION_LIMITS.maxNodeSize || 0) +
      NORMALIZATION_LIMITS.minNodeSize;
    // eslint-disable-next-line no-param-reassign
    node.label = {
      ...node.label,
      show: showSymbolThreshold ? node.value > showSymbolThreshold : true,
    };
  });
  const [linkMinValue, linkMaxValue] = d3Extent(links, x => x.value) as [number, number];
  const linkSpread = linkMaxValue - linkMinValue;
  links.forEach(link => {
    // eslint-disable-next-line no-param-reassign
    link.lineStyle!.width =
      ((link.value! - linkMinValue) / linkSpread) * NORMALIZATION_LIMITS.maxEdgeWidth ||
      0 + NORMALIZATION_LIMITS.minEdgeWidth;
  });
}

function getKeyByValue(object: { [name: string]: number }, value: number): string {
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
  return `${getKeyByValue(nodes, source)} > ${getKeyByValue(nodes, target)} : ${value}`;
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
  }: EchartsGraphFormData = { ...DEFAULT_GRAPH_FORM_DATA, ...formData };

  const metricLabel = getMetricLabel(metric);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const nodes: { [name: string]: number } = {};
  const categories: Set<string> = new Set();
  const echartNodes: EChartGraphNode[] = [];
  const echartLinks: GraphEdgeItemOption[] = [];

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
    });
  });

  normalizeStyles(echartNodes, echartLinks, { showSymbolThreshold });

  const categoryList = [...categories];

  const series: GraphSeriesOption[] = [
    {
      zoom: DEFAULT_GRAPH_SERIES_OPTION.zoom,
      type: 'graph',
      categories: categoryList.map(c => ({ name: c, itemStyle: { color: colorFn(c) } })),
      layout,
      force: { ...DEFAULT_GRAPH_SERIES_OPTION.force, edgeLength, gravity, repulsion, friction },
      circular: DEFAULT_GRAPH_SERIES_OPTION.circular,
      data: echartNodes,
      links: echartLinks,
      roam,
      draggable,
      edgeSymbol: DEFAULT_GRAPH_SERIES_OPTION.edgeSymbol,
      edgeSymbolSize: DEFAULT_GRAPH_SERIES_OPTION.edgeSymbolSize,
      selectedMode,
      ...getChartPadding(showLegend, legendOrientation, legendMargin),
      animation: DEFAULT_GRAPH_SERIES_OPTION.animation,
      label: DEFAULT_GRAPH_SERIES_OPTION.label,
      lineStyle: DEFAULT_GRAPH_SERIES_OPTION.lineStyle,
      emphasis: DEFAULT_GRAPH_SERIES_OPTION.emphasis,
    },
  ];

  const echartOptions: EChartsOption = {
    animationDuration: DEFAULT_GRAPH_SERIES_OPTION.animationDuration,
    animationEasing: DEFAULT_GRAPH_SERIES_OPTION.animationEasing,
    tooltip: {
      formatter: (params: any): string =>
        edgeFormatter(params.data.source, params.data.target, params.value, nodes),
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
