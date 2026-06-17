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

/**
 * ECharts Sankey Chart - Glyph Pattern Implementation
 *
 * Visualizes flow between nodes using proportional link widths.
 * Each link represents a value flowing from source to target.
 */

import { t } from '@apache-superset/core/translation';
import type { ComposeOption } from 'echarts/core';
import type { SankeySeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  buildQueryContext,
  CategoricalColorNamespace,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  NumberFormats,
  QueryFormData,
  tooltipHtml,
} from '@superset-ui/core';

import {
  defineChart,
  Metric,
  Dimension,
  ChartProps,
  SortByMetric,
} from '@superset-ui/glyph-core';

import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';
import Echart from '../components/Echart';
import { Refs } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.png';
import example1Dark from './images/example1-dark.png';
import example2 from './images/example2.png';
import example2Dark from './images/example2-dark.png';

// ============================================================================
// Types
// ============================================================================

type Link = { source: string; target: string; value: number };
type EChartsOption = ComposeOption<SankeySeriesOption>;

interface SankeyTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsOption;
    formData: Record<string, unknown>;
  };
}

// ============================================================================
// Build Query - exported for testing
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const { metric, sort_by_metric: sortByMetric, source, target } = formData;
  const groupby = [source, target];
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      groupby,
      ...(sortByMetric && { orderby: [[metric, false]] }),
    },
  ]);
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Sankey Chart'),
    description: t(
      `The Sankey chart visually tracks the movement and transformation of values across
      system stages. Nodes represent stages, connected by links depicting value flow. Node
      height corresponds to the visualized metric, providing a clear representation of
      value distribution and transformation.`,
    ),
    category: t('Flow'),
    tags: [t('Directional'), t('ECharts'), t('Distribution'), t('Flow')],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
  },

  arguments: {
    source: Dimension.with({
      label: t('Source'),
      description: t('The column to be used as the source of the edge.'),
      multi: false,
    }),

    target: Dimension.with({
      label: t('Target'),
      description: t('The column to be used as the target of the edge.'),
      multi: false,
    }),

    metric: Metric.with({
      label: t('Metric'),
      description: t('The value that determines link width.'),
      multi: false,
    }),

    sortByMetric: SortByMetric,
  },

  buildQuery,

  transform: (chartProps: ChartProps): SankeyTransformResult => {
    const refs: Refs = {};
    const { height, queriesData, width, theme, rawFormData } = chartProps;
    const { data } = queriesData[0];

    const colorScheme = rawFormData.color_scheme as string;
    const metric = rawFormData.metric as string;
    const source = rawFormData.source as string;
    const target = rawFormData.target as string;
    const sliceId = rawFormData.slice_id as number | undefined;

    const colorFn = CategoricalColorNamespace.getScale(colorScheme);
    const metricLabel = getMetricLabel(metric);
    const valueFormatter = getNumberFormatter(NumberFormats.FLOAT_2_POINT);
    const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);

    const links: Link[] = [];
    const set = new Set<string>();

    data.forEach((datum: Record<string, unknown>) => {
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
        color: colorFn(name, sliceId),
      },
      label: {
        color: (theme as { colorText?: string })?.colorText,
        textShadow: (theme as { colorBgBase?: string })?.colorBgBase,
      },
    }));

    // Stores a map with the total values for each node considering the links
    const incomingFlows = new Map<string, number>();
    const outgoingFlows = new Map<string, number>();
    const allNodeNames = new Set<string>();

    links.forEach(link => {
      const { source: linkSource, target: linkTarget, value } = link;
      allNodeNames.add(linkSource);
      allNodeNames.add(linkTarget);
      incomingFlows.set(
        linkTarget,
        (incomingFlows.get(linkTarget) || 0) + value,
      );
      outgoingFlows.set(
        linkSource,
        (outgoingFlows.get(linkSource) || 0) + value,
      );
    });

    const nodeValues = new Map<string, number>();

    allNodeNames.forEach(nodeName => {
      const totalIncoming = incomingFlows.get(nodeName) || 0;
      const totalOutgoing = outgoingFlows.get(nodeName) || 0;
      nodeValues.set(nodeName, Math.max(totalIncoming, totalOutgoing));
    });

    const tooltipFormatter = (params: CallbackDataParams) => {
      const { name, data: paramData } = params;
      const value = params.value as number;
      const rows = [[metricLabel, valueFormatter.format(value)]];
      const { source: linkSource, target: linkTarget } = paramData as Link;
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
      transformedProps: {
        refs,
        formData: rawFormData,
        width,
        height,
        echartOptions,
      },
    };
  },

  render: ({ transformedProps }) => {
    const { height, width, echartOptions, refs, formData } = transformedProps;

    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        vizType={formData.vizType as string}
      />
    );
  },
});
