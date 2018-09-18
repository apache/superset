import d3 from 'd3';
import $ from 'jquery';
import PropTypes from 'prop-types';
import dt from 'datatables.net-bs';
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import dompurify from 'dompurify';
import { fixDataTableBodyHeight, d3TimeFormatPreset } from '../modules/utils';
import './table.css';

dt(window, $);

const propTypes = {
  // Each object is { field1: value1, field2: value2 }
  data: PropTypes.arrayOf(PropTypes.object),
  height: PropTypes.number,
  alignPositiveNegative: PropTypes.bool,
  colorPositiveNegative: PropTypes.bool,
  columns: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    format: PropTypes.string,
  })),
  filters: PropTypes.object,
  includeSearch: PropTypes.bool,
  metrics: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
  ])),
  onAddFilter: PropTypes.func,
  onRemoveFilter: PropTypes.func,
  orderDesc: PropTypes.bool,
  pageLength: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  percentMetrics: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
  ])),
  tableFilter: PropTypes.bool,
  tableTimestampFormat: PropTypes.string,
  timeseriesLimitMetric: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
  ]),
};

const formatValue = d3.format('0,000');
const formatPercent = d3.format('.3p');
function NOOP() {}

function TableVis(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'TableVis');

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

  const metrics = (rawMetrics || []).map(m => m.label || m)
    // Add percent metrics
    .concat((percentMetrics || []).map(m => '%' + m))
    // Removing metrics (aggregates) that are strings
    .filter(m => (typeof data[0][m]) === 'number');

  function col(c) {
    const arr = [];
    for (let i = 0; i < data.length; i += 1) {
      arr.push(data[i][c]);
    }
    return arr;
  }
  const maxes = {};
  const mins = {};
  for (let i = 0; i < metrics.length; i += 1) {
    if (alignPositiveNegative) {
      maxes[metrics[i]] = d3.max(col(metrics[i]).map(Math.abs));
    } else {
      maxes[metrics[i]] = d3.max(col(metrics[i]));
      mins[metrics[i]] = d3.min(col(metrics[i]));
    }
  }

  const tsFormatter = d3TimeFormatPreset(tableTimestampFormat);

  const div = d3.select(element);
  div.html('');
  const table = div.append('table')
    .classed(
      'dataframe dataframe table table-striped ' +
      'table-condensed table-hover dataTable no-footer', true)
    .attr('width', '100%');

  table.append('thead').append('tr')
    .selectAll('th')
    .data(columns.map(c => c.label))
    .enter()
    .append('th')
    .text(d => d);

  table.append('tbody')
    .selectAll('tr')
    .data(data)
    .enter()
    .append('tr')
    .selectAll('td')
    .data(row => columns.map(({ key, format }) => {
      const val = row[key];
      let html;
      const isMetric = metrics.indexOf(key) >= 0;
      if (key === '__timestamp') {
        html = tsFormatter(val);
      }
      if (typeof (val) === 'string') {
        html = `<span class="like-pre">${dompurify.sanitize(val)}</span>`;
      }
      if (isMetric) {
        html = d3.format(format || '0.3s')(val);
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
    }))
    .enter()
    .append('td')
    .style('background-image', function (d) {
      if (d.isMetric) {
        const r = (colorPositiveNegative && d.val < 0) ? 150 : 0;
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
    .attr('title', d => (!Number.isNaN(d.val) ? formatValue(d.val) : null))
    .attr('data-sort', d => (d.isMetric) ? d.val : null)
    // Check if the dashboard currently has a filter for each row
    .classed('filtered', d =>
      filters &&
      filters[d.col] &&
      filters[d.col].indexOf(d.val) >= 0,
    )
    .on('click', function (d) {
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
    .style('cursor', d => (!d.isMetric) ? 'pointer' : '')
    .html(d => d.html ? d.html : d.val);

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

  fixDataTableBodyHeight($container.find('.dataTables_wrapper'), height);
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
    if (metrics.indexOf(sortBy) < 0) {
      // Hiding the sortBy column if not in the metrics list
      datatable.column(index).visible(false);
    }
  }
  datatable.draw();
}

TableVis.propTypes = propTypes;

function adaptor(slice, payload) {
  const { selector, formData, datasource } = slice;
  const {
    align_pn: alignPositiveNegative,
    color_pn: colorPositiveNegative,
    include_search: includeSearch,
    metrics,
    order_desc: orderDesc,
    page_length: pageLength,
    percent_metrics: percentMetrics,
    table_filter: tableFilter,
    table_timestamp_format: tableTimestampFormat,
    timeseries_limit_metric: timeseriesLimitMetric,
  } = formData;
  const {
    verbose_map: verboseMap,
    column_formats: columnFormats,
  } = datasource;

  const { records, columns } = payload.data;

  const processedColumns = columns.map((key) => {
    let label = verboseMap[key];
    // Handle verbose names for percents
    if (!label) {
      if (key[0] === '%') {
        const cleanedKey = key.substring(1);
        label = '% ' + (verboseMap[cleanedKey] || cleanedKey);
      } else {
        label = key;
      }
    }
    return {
      key,
      label,
      format: columnFormats && columnFormats[key],
    };
  });

  const element = document.querySelector(selector);

  return TableVis(element, {
    data: records,
    height: slice.height(),
    alignPositiveNegative,
    colorPositiveNegative,
    columns: processedColumns,
    filters: slice.getFilters(),
    includeSearch,
    metrics,
    onAddFilter(...args) { slice.addFilter(...args); },
    orderDesc,
    pageLength: pageLength && parseInt(pageLength, 10),
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
  });
}

export default adaptor;
