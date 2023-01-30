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
import PropTypes from 'prop-types';
import { extent as d3Extent, range as d3Range } from 'd3-array';
import { select as d3Select } from 'd3-selection';
import { getSequentialSchemeRegistry, t } from '@superset-ui/core';
import CalHeatMap from './vendor/cal-heatmap';

const propTypes = {
  data: PropTypes.shape({
    // Object hashed by metric name,
    // then hashed by timestamp (in seconds, not milliseconds) as float
    // the innermost value is count
    // e.g. { count_distinct_something: { 1535034236.0: 3 } }
    data: PropTypes.object,
    domain: PropTypes.string,
    range: PropTypes.number,
    // timestamp in milliseconds
    start: PropTypes.number,
    subdomain: PropTypes.string,
  }),
  height: PropTypes.number,
  // eslint-disable-next-line react/sort-prop-types
  cellPadding: PropTypes.number,
  // eslint-disable-next-line react/sort-prop-types
  cellRadius: PropTypes.number,
  // eslint-disable-next-line react/sort-prop-types
  cellSize: PropTypes.number,
  linearColorScheme: PropTypes.string,
  showLegend: PropTypes.bool,
  showMetricName: PropTypes.bool,
  showValues: PropTypes.bool,
  steps: PropTypes.number,
  timeFormatter: PropTypes.func,
  valueFormatter: PropTypes.func,
  verboseMap: PropTypes.object,
  theme: PropTypes.object,
};

function Calendar(element, props) {
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
    ? (date, value) => valueFormatter(value)
    : null;

  const metricsData = data.data;

  const METRIC_TEXT = t('Metric');

  Object.keys(metricsData).forEach(metric => {
    const calContainer = div.append('div');
    if (showMetricName) {
      calContainer.text(`${METRIC_TEXT}: ${verboseMap[metric] || metric}`);
    }
    const timestamps = metricsData[metric];
    const extents = d3Extent(Object.keys(timestamps), key => timestamps[key]);
    const step = (extents[1] - extents[0]) / (steps - 1);
    const colorScale = getSequentialSchemeRegistry()
      .get(linearColorScheme)
      .createLinearScale(extents);

    const legend = d3Range(steps).map(i => extents[0] + step * i);
    const legendColors = legend.map(x => colorScale(x));

    const cal = new CalHeatMap();
    cal.init({
      start: data.start,
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
        empty: theme.colors.grayscale.light5,
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
Calendar.propTypes = propTypes;

export default Calendar;
