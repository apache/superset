import d3 from 'd3';
import PropTypes from 'prop-types';
import $ from 'jquery';
import dt from 'datatables.net-bs';
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import dompurify from 'dompurify';
import { fixDataTableBodyHeight, d3TimeFormatPreset } from '../modules/utils';
import './table.css';

dt(window, $);

const propTypes = {
  data: PropTypes.shape({
    records: PropTypes.arrayOf(PropTypes.object),
    columns: PropTypes.arrayOf(PropTypes.string),
  }),
  height: PropTypes.number,
  alignPn: PropTypes.bool,
  colorPn: PropTypes.bool,
  columnFormats: PropTypes.object,
  filters: PropTypes.object,
  includeSearch: PropTypes.bool,
  metrics: PropTypes.arrayOf(PropTypes.string),
  onAddFilter: PropTypes.func,
  onRemoveFilter: PropTypes.func,
  orderDesc: PropTypes.bool,
  pageLength: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  percentMetrics: PropTypes.array,
  tableFilter: PropTypes.bool,
  tableTimestampFormat: PropTypes.string,
  timeseriesLimitMetric: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
  ]),
  verboseMap: PropTypes.object,
};

const fC = d3.format('0,000');
function NOOP() {}

function TableVis(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'TableVis');

  const {
    data,
    height,
    alignPn,
    colorPn,
    columnFormats,
    filters,
    includeSearch,
    metrics: rawMetrics,
    onAddFilter = NOOP,
    onRemoveFilter = NOOP,
    orderDesc,
    pageLength,
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
    verboseMap,
  } = props;

  const { columns, records } = data;

  const $container = $(element);

  const metrics = (rawMetrics || []).map(m => m.label || m)
    // Add percent metrics
    .concat((percentMetrics || []).map(m => '%' + m))
    // Removing metrics (aggregates) that are strings
    .filter(m => !Number.isNaN(records[0][m]));

  function col(c) {
    const arr = [];
    for (let i = 0; i < records.length; i += 1) {
      arr.push(records[i][c]);
    }
    return arr;
  }
  const maxes = {};
  const mins = {};
  for (let i = 0; i < metrics.length; i += 1) {
    if (alignPn) {
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

  const cols = columns.map((c) => {
    if (verboseMap[c]) {
      return verboseMap[c];
    }
    // Handle verbose names for percents
    if (c[0] === '%') {
      const cName = c.substring(1);
      return '% ' + (verboseMap[cName] || cName);
    }
    return c;
  });

  table.append('thead').append('tr')
    .selectAll('th')
    .data(cols)
    .enter()
    .append('th')
    .text(d => d);

  table.append('tbody')
    .selectAll('tr')
    .data(records)
    .enter()
    .append('tr')
    .selectAll('td')
    .data(row => columns.map((c) => {
      const val = row[c];
      let html;
      const isMetric = metrics.indexOf(c) >= 0;
      if (c === '__timestamp') {
        html = tsFormatter(val);
      }
      if (typeof (val) === 'string') {
        html = `<span class="like-pre">${dompurify.sanitize(val)}</span>`;
      }
      if (isMetric) {
        const format = (columnFormats && columnFormats[c]) || '0.3s';
        html = d3.format(format)(val);
      } else if (c[0] === '%') {
        html = d3.format('.3p')(val);
      }
      return {
        col: c,
        val,
        html,
        isMetric,
      };
    }))
    .enter()
    .append('td')
    .style('background-image', function (d) {
      if (d.isMetric) {
        const r = (colorPn && d.val < 0) ? 150 : 0;
        if (alignPn) {
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
    .attr('title', (d) => {
      if (!Number.isNaN(d.val)) {
        return fC(d.val);
      }
      return null;
    })
    .attr('data-sort', function (d) {
      return (d.isMetric) ? d.val : null;
    })
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
    .style('cursor', function (d) {
      return (!d.isMetric) ? 'pointer' : '';
    })
    .html(d => d.html ? d.html : d.val);

  const paging = pageLength && pageLength > 0;

  const datatable = $container.find('.dataTable').DataTable({
    paging,
    pageLength: paging ? parseInt(pageLength, 10) : undefined,
    aaSorting: [],
    searching: includeSearch,
    bInfo: false,
    scrollY: height + 'px',
    scrollCollapse: true,
    scrollX: true,
  });

  fixDataTableBodyHeight($container.find('.dataTables_wrapper'), height);
  // Sorting table by main column
  let sortBy;
  if (timeseriesLimitMetric) {
    // Sort by as specified
    sortBy = timeseriesLimitMetric.label || timeseriesLimitMetric;
  } else if (metrics.length > 0) {
    // If not specified, use the first metric from the list
    sortBy = metrics[0];
  }
  if (sortBy) {
    datatable.column(columns.indexOf(sortBy)).order(orderDesc ? 'desc' : 'asc');
  }
  if (sortBy && metrics.indexOf(sortBy) < 0) {
    // Hiding the sortBy column if not in the metrics list
    datatable.column(columns.indexOf(sortBy)).visible(false);
  }
  datatable.draw();
  $container.parents('.widget').find('.tooltip').remove();
}

TableVis.propTypes = propTypes;

function adaptor(slice, payload) {
  const { selector, formData, datasource } = slice;
  const {
    align_pn: alignPn,
    color_pn: colorPn,
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
  const element = document.querySelector(selector);

  return TableVis(element, {
    data: payload.data,
    height: slice.height(),
    alignPn,
    colorPn,
    columnFormats,
    filters: slice.getFilters(),
    includeSearch,
    metrics,
    onAddFilter(...args) { slice.addFilter(...args); },
    orderDesc,
    pageLength,
    percentMetrics,
    // Aug 22, 2018
    // Perhaps this field can be removed as there is
    // no code left in repo to set tableFilter to true.
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
    verboseMap,
  });
}

export default adaptor;
