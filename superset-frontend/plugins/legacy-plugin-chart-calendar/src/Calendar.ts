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
import { extent as d3Extent, range as d3Range } from 'd3-array';
import { select as d3Select } from 'd3-selection';
import { getSequentialSchemeRegistry } from '@superset-ui/core';
import { SupersetTheme, t } from '@apache-superset/core/ui';
import CalHeatMapImport from './vendor/cal-heatmap';
import { convertUTCTimestampToLocal } from './utils';

// The vendor file is @ts-nocheck, so its export lacks type info.
// Define a minimal constructor interface for use in this file.
interface CalHeatMapInstance {
  init(config: Record<string, unknown>): void;
}
const CalHeatMap = CalHeatMapImport as unknown as new () => CalHeatMapInstance;

interface CalendarData {
  data: Record<string, Record<string, number>>;
  domain: string;
  range: number;
  start: number;
  subdomain: string;
}

interface CalendarProps {
  data: CalendarData;
  height: number;
  cellPadding?: number;
  cellRadius?: number;
  cellSize?: number;
  domainGranularity: string;
  linearColorScheme: string;
  showLegend: boolean;
  showMetricName: boolean;
  showValues: boolean;
  steps: number;
  subdomainGranularity: string;
  timeFormatter: (ts: number | string) => string;
  valueFormatter: (value: number) => string;
  verboseMap: Record<string, string>;
  theme: SupersetTheme;
}

function Calendar(element: HTMLElement, props: CalendarProps) {
  const {
    data,
    height,
    cellPadding = 3,
    cellRadius = 0,
    cellSize = 10,
    domainGranularity,
    linearColorScheme,
    showLegend,
    showMetricName,
    showValues,
    steps,
    subdomainGranularity,
    timeFormatter,
    valueFormatter,
    verboseMap,
    theme,
  } = props;

  const container = d3Select(element)
    .classed('superset-legacy-chart-calendar', true)
    .style('height', height);
  container.selectAll('*').remove();
  const div = container.append('div');

  const subDomainTextFormat = showValues
    ? (_date: Date, value: number) => valueFormatter(value)
    : null;

  const metricsData = data.data;

  const METRIC_TEXT = t('Metric');

  Object.keys(metricsData).forEach(metric => {
    const calContainer = div.append('div');
    if (showMetricName) {
      calContainer.text(`${METRIC_TEXT}: ${verboseMap[metric] || metric}`);
    }
    const timestamps = metricsData[metric];
    const rawExtents = d3Extent(
      Object.keys(timestamps),
      key => timestamps[key],
    );
    // Guard against undefined extents (empty data)
    const extents: [number, number] =
      rawExtents[0] != null && rawExtents[1] != null
        ? [rawExtents[0], rawExtents[1]]
        : [0, 1];
    // Guard against division by zero when steps <= 1
    const step = steps > 1 ? (extents[1] - extents[0]) / (steps - 1) : 0;
    const colorScheme = getSequentialSchemeRegistry().get(linearColorScheme);
    const colorScale = colorScheme
      ? colorScheme.createLinearScale(extents)
      : (_v: number) => '#ccc'; // fallback if scheme not found

    const legend = d3Range(steps).map(i => extents[0] + step * i);
    const legendColors = legend.map(x => colorScale(x));

    const cal = new CalHeatMap();
    cal.init({
      start: convertUTCTimestampToLocal(data.start),
      data: timestamps,
      itemSelector: calContainer.node(),
      legendVerticalPosition: 'top',
      cellSize,
      cellPadding,
      cellRadius,
      legendCellSize: cellSize,
      legendCellPadding: 2,
      legendCellRadius: cellRadius,
      tooltip: true,
      domain: domainGranularity,
      subDomain: subdomainGranularity,
      range: data.range,
      browsing: true,
      legend,
      legendColors: {
        colorScale,
        min: legendColors[0],
        max: legendColors[legendColors.length - 1],
        empty: theme.colorBgElevated,
      },
      displayLegend: showLegend,
      itemName: '',
      valueFormatter,
      timeFormatter,
      subDomainTextFormat,
    });
  });
}

Calendar.displayName = 'Calendar';

export default Calendar;
