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
  NumberFormats,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { SankeyChartProps, SankeyTransformedProps } from './types';
import { Refs } from '../types';
import { NULL_STRING } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';

type Link = { source: string; target: string; value: number };
type EChartsOption = ComposeOption<SankeySeriesOption>;

// Separates the level index from the display value in internal node names of
// multi-level charts. NUL cannot occur in SQL string values, so the prefix
// can always be stripped unambiguously.
const LEVEL_DELIMITER = '\0';

// Pixel budget for node labels before they are truncated with an ellipsis.
const LABEL_MAX_WIDTH = 120;

export default function transformProps(
  chartProps: SankeyChartProps,
): SankeyTransformedProps {
  const refs: Refs = {};
  const { formData, height, hooks, queriesData, width, theme } = chartProps;
  const { onLegendStateChanged } = hooks;
  const {
    colorScheme,
    metric,
    source,
    target,
    intermediateLevels,
    nodeAlignment,
    roam,
    sliceId,
  } = formData;
  const { data } = queriesData[0];
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const metricLabel = getMetricLabel(metric);
  const valueFormatter = getNumberFormatter(NumberFormats.FLOAT_2_POINT);
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);

  const levelColumns = [
    source,
    ...ensureIsArray(intermediateLevels),
    target,
  ].map(getColumnLabel);
  // Node names are level-prefixed only in multi-level mode: it guarantees
  // unique names per level and forward-only links (no accidental merges or
  // cycles), while the plain two-column mode keeps raw names so edge-list
  // datasets can still chain flows across rows via shared node names.
  const isMultiLevel = levelColumns.length > 2;

  const makeNodeName = (levelIndex: number, value: DataRecordValue): string => {
    const display =
      value === null || value === undefined ? NULL_STRING : String(value);
    return isMultiLevel ? `${levelIndex}${LEVEL_DELIMITER}${display}` : display;
  };

  const displayName = (name: string): string =>
    isMultiLevel ? name.slice(name.indexOf(LEVEL_DELIMITER) + 1) : name;

  const linkMap = new Map<string, Link>();
  const nodeLevels = new Map<string, number>();
  data.forEach(datum => {
    const value = datum[metricLabel] as number;
    for (let level = 0; level < levelColumns.length - 1; level += 1) {
      const sourceName = makeNodeName(level, datum[levelColumns[level]]);
      const targetName = makeNodeName(
        level + 1,
        datum[levelColumns[level + 1]],
      );
      nodeLevels.set(sourceName, level);
      nodeLevels.set(targetName, level + 1);
      const linkKey = `${sourceName}${LEVEL_DELIMITER}${LEVEL_DELIMITER}${targetName}`;
      const link = linkMap.get(linkKey);
      if (link) {
        link.value += value;
      } else {
        linkMap.set(linkKey, {
          source: sourceName,
          target: targetName,
          value,
        });
      }
    }
  });
  const links = Array.from(linkMap.values());

  const lastLevel = levelColumns.length - 1;
  const seriesData: NonNullable<SankeySeriesOption['data']> = Array.from(
    nodeLevels,
  ).map(([name, level]) => ({
    name,
    // Pinning each node to its column keeps the layout stable even when a
    // value only appears in later levels.
    ...(isMultiLevel && { depth: level }),
    itemStyle: {
      // color by display name so the same value shares a color across levels
      color: colorFn(displayName(name), sliceId),
    },
    label: {
      color: theme.colorText,
      textShadow: theme.colorBgBase,
      // keep last-level labels inside the plot area
      ...(isMultiLevel && level === lastLevel && { position: 'left' as const }),
    },
  }));

  // stores a map with the total values for each node considering the links
  const incomingFlows = new Map<string, number>();
  const outgoingFlows = new Map<string, number>();

  links.forEach(link => {
    incomingFlows.set(
      link.target,
      (incomingFlows.get(link.target) || 0) + link.value,
    );
    outgoingFlows.set(
      link.source,
      (outgoingFlows.get(link.source) || 0) + link.value,
    );
  });

  const nodeValues = new Map<string, number>();

  nodeLevels.forEach((level, name) => {
    const totalIncoming = incomingFlows.get(name) || 0;
    const totalOutgoing = outgoingFlows.get(name) || 0;

    nodeValues.set(name, Math.max(totalIncoming, totalOutgoing));
  });

  const tooltipFormatter = (params: CallbackDataParams) => {
    const { name, data } = params;
    const value = params.value as number;
    const rows = [[metricLabel, valueFormatter.format(value)]];
    const { source, target } = data as Link;
    if (source && target) {
      rows.push([
        `% (${displayName(source)})`,
        percentFormatter.format(value / nodeValues.get(source)!),
      ]);
      rows.push([
        `% (${displayName(target)})`,
        percentFormatter.format(value / nodeValues.get(target)!),
      ]);
      const title = isMultiLevel
        ? `${displayName(source)} → ${displayName(target)}`
        : name;
      return tooltipHtml(rows, title);
    }
    return tooltipHtml(rows, displayName(name));
  };

  const echartOptions: EChartsOption = {
    series: {
      animation: false,
      data: seriesData,
      emphasis: {
        focus: 'adjacency',
      },
      label: {
        formatter: params => displayName(params.name),
        // Long category values (cloud service names, product SKUs) otherwise
        // push the flow area off the canvas; the full value stays in the
        // tooltip.
        width: LABEL_MAX_WIDTH,
        overflow: 'truncate',
      },
      lineStyle: {
        color: 'gradient',
        curveness: 0.5,
        opacity: 0.5,
      },
      links,
      nodeAlign: nodeAlignment ?? 'justify',
      // nodeGap is a fixed pixel budget: nodeGap * (nodes in the tallest
      // column) competes with the canvas height, and ECharts drops the whole
      // column once the gaps no longer fit. Keep its default rather than a
      // larger value so high-cardinality levels still render.
      nodeWidth: 12,
      // Pan/zoom so a diagram with more nodes than fit stays explorable in a
      // small dashboard tile.
      roam: roam ?? true,
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
