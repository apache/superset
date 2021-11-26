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
/* eslint-disable func-names, no-negated-condition */
/* eslint-disable prefer-destructuring */
/* eslint-disable react/sort-prop-types */
import d3 from 'd3';
import PropTypes from 'prop-types';
import dt from 'datatables.net-bs/js/dataTables.bootstrap';
import dompurify from 'dompurify';
import { getNumberFormatter, NumberFormats } from '@superset-ui/number-format';
import { getTimeFormatter } from '@superset-ui/time-format';
import fixTableHeight from './utils/fixTableHeight';
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import './Table.css';

if (window.$) {
  dt(window, window.$);
}
const $ = window.$ || dt.$;

const propTypes = {
  // Each object is { field1: value1, field2: value2 }
  data: PropTypes.arrayOf(PropTypes.object),
  height: PropTypes.number,
  alignPositiveNegative: PropTypes.bool,
  colorPositiveNegative: PropTypes.bool,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      format: PropTypes.string,
    }),
  ),
  filters: PropTypes.object,
  includeSearch: PropTypes.bool,
  metrics: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
  onAddFilter: PropTypes.func,
  onRemoveFilter: PropTypes.func,
  orderDesc: PropTypes.bool,
  pageLength: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  percentMetrics: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
  tableFilter: PropTypes.bool,
  tableTimestampFormat: PropTypes.string,
  timeseriesLimitMetric: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};

const formatValue = getNumberFormatter(NumberFormats.INTEGER);
const formatPercent = getNumberFormatter(NumberFormats.PERCENT_3_POINT);
const NOOP = () => {};

function TableVis(element, props) {
  const {
    data,
    height,
    alignPositiveNegative = false,
    colorPositiveNegative = false,
    columns,
    filters = {},
    includeSearch = false,
    metrics: rawMetrics,
    onAddFilter = NOOP,
    onRemoveFilter = NOOP,
    orderDesc,
    pageLength,
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
  } = props;

  const $container = $(element);
  $container.addClass('superset-legacy-chart-table');

  const metrics = (rawMetrics || [])
    .map(m => m.label || m)
    // Add percent metrics
    .concat((percentMetrics || []).map(m => `%${m}`))
    // Removing metrics (aggregates) that are strings
    .filter(m => typeof data[0][m] === 'number');

  function col(c) {
    const arr = [];
    data.forEach(row => {
      arr.push(row[c]);
    });

    return arr;
  }
  const maxes = {};
  const mins = {};
  metrics.forEach(metric => {
    if (alignPositiveNegative) {
      maxes[metric] = d3.max(col(metric).map(Math.abs));
    } else {
      maxes[metric] = d3.max(col(metric));
      mins[metric] = d3.min(col(metric));
    }
  });

  const tsFormatter = getTimeFormatter(tableTimestampFormat);

  const div = d3.select(element);
  div.html('');
  const table = div
    .append('table')
    .classed(
      'dataframe dataframe table table-striped ' +
        'table-condensed table-hover dataTable no-footer',
      true,
    )
    .attr('width', '100%');

  table
    .append('thead')
    .append('tr')
    .selectAll('th')
    .data(columns.map(c => c.label))
    .enter()
    .append('th')
    .text(d => d);

  table
    .append('tbody')
    .selectAll('tr')
    .data(data)
    .enter()
    .append('tr')
    .selectAll('td')
    .data(row =>
      columns.map(({ key, format }) => {
        const val = row[key];
        let html;
        const isMetric = metrics.includes(key);
        if (key === '__timestamp') {
          html = tsFormatter(val);
        }
        if (typeof val === 'string') {
          html = `<span class="like-pre">${dompurify.sanitize(val)}</span>`;
        }
        if (isMetric) {
          html = getNumberFormatter(format)(val);
        }
        if (key[0] === '%') {
          html = formatPercent(val);
        }

        return {
          col: key,
          val,
          html,
          isMetric,
        };
      }),
    )
    .enter()
    .append('td')
    .style('background-image', d => {
      if (d.isMetric) {
        const r = colorPositiveNegative && d.val < 0 ? 150 : 0;
        if (alignPositiveNegative) {
          const perc = Math.abs(Math.round((d.val / maxes[d.col]) * 100));

          // The 0.01 to 0.001 is a workaround for what appears to be a
          // CSS rendering bug on flat, transparent colors
          return (
            `linear-gradient(to right, rgba(${r},0,0,0.2), rgba(${r},0,0,0.2) ${perc}%, ` +
            `rgba(0,0,0,0.01) ${perc}%, rgba(0,0,0,0.001) 100%)`
          );
        }
        const posExtent = Math.abs(Math.max(maxes[d.col], 0));
        const negExtent = Math.abs(Math.min(mins[d.col], 0));
        const tot = posExtent + negExtent;
        const perc1 = Math.round((Math.min(negExtent + d.val, negExtent) / tot) * 100);
        const perc2 = Math.round((Math.abs(d.val) / tot) * 100);

        // The 0.01 to 0.001 is a workaround for what appears to be a
        // CSS rendering bug on flat, transparent colors
        return (
          `linear-gradient(to right, rgba(0,0,0,0.01), rgba(0,0,0,0.001) ${perc1}%, ` +
          `rgba(${r},0,0,0.2) ${perc1}%, rgba(${r},0,0,0.2) ${perc1 + perc2}%, ` +
          `rgba(0,0,0,0.01) ${perc1 + perc2}%, rgba(0,0,0,0.001) 100%)`
        );
      }

      return null;
    })
    .classed('text-right', d => d.isMetric)
    .attr('title', d => {
      if (typeof d.val === 'string') {
        return d.val;
      }
      if (!Number.isNaN(d.val)) {
        return formatValue(d.val);
      }

      return null;
    })
    .attr('data-sort', d => (d.isMetric ? d.val : null))
    // Check if the dashboard currently has a filter for each row
    .classed('filtered', d => filters && filters[d.col] && filters[d.col].includes(d.val))
    .on('click', function(d) {
      if (!d.isMetric && tableFilter) {
        const td = d3.select(this);
        if (td.classed('filtered')) {
          onRemoveFilter(d.col, [d.val]);
          d3.select(this).classed('filtered', false);
        } else {
          d3.select(this).classed('filtered', true);
          onAddFilter(d.col, [d.val]);
        }
      }
    })
    .style('cursor', d => (!d.isMetric ? 'pointer' : ''))
    .html(d => (d.html ? d.html : d.val));

  const paging = pageLength && pageLength > 0;

  const datatable = $container.find('.dataTable').DataTable({
    paging,
    pageLength,
    aaSorting: [],
    searching: includeSearch,
    bInfo: false,
    scrollY: `${height}px`,
    scrollCollapse: true,
    scrollX: true,
  });

  fixTableHeight($container.find('.dataTables_wrapper'), height);
  // Sorting table by main column
  let sortBy;
  const limitMetric = Array.isArray(timeseriesLimitMetric)
    ? timeseriesLimitMetric[0]
    : timeseriesLimitMetric;
  if (limitMetric) {
    // Sort by as specified
    sortBy = limitMetric.label || limitMetric;
  } else if (metrics.length > 0) {
    // If not specified, use the first metric from the list
    sortBy = metrics[0];
  }
  if (sortBy) {
    const keys = columns.map(c => c.key);
    const index = keys.indexOf(sortBy);
    datatable.column(index).order(orderDesc ? 'desc' : 'asc');
    if (!metrics.includes(sortBy)) {
      // Hiding the sortBy column if not in the metrics list
      datatable.column(index).visible(false);
    }
  }
  datatable.draw();
}

TableVis.displayName = 'TableVis';
TableVis.propTypes = propTypes;

export default TableVis;
