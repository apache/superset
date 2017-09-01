import d3 from 'd3';
import dt from 'datatables.net-bs';
import 'datatables.net-bs/css/dataTables.bootstrap.css';

import { fixDataTableBodyHeight, d3TimeFormatPreset } from '../javascripts/modules/utils';
import './table.css';

const $ = require('jquery');

dt(window, $);

function tableVis(slice, payload) {
  const container = $(slice.selector);
  const fC = d3.format('0,000');

  const data = payload.data;
  const fd = slice.formData;

  // Removing metrics (aggregates) that are strings
  let metrics = fd.metrics || [];
  metrics = metrics.filter(m => !isNaN(data.records[0][m]));

  function col(c) {
    const arr = [];
    for (let i = 0; i < data.records.length; i += 1) {
      arr.push(data.records[i][c]);
    }
    return arr;
  }
  const maxes = {};
  for (let i = 0; i < metrics.length; i += 1) {
    maxes[metrics[i]] = d3.max(col(metrics[i]));
  }

  const tsFormatter = d3TimeFormatPreset(fd.table_timestamp_format);

  const div = d3.select(slice.selector);
  div.html('');
  const table = div.append('table')
    .classed(
      'dataframe dataframe table table-striped table-bordered ' +
      'table-condensed table-hover dataTable no-footer', true)
    .attr('width', '100%');

  const cols = data.columns.map(c => slice.datasource.verbose_map[c] || c);

  table.append('thead').append('tr')
    .selectAll('th')
    .data(cols)
    .enter()
    .append('th')
    .text(function (d) {
      return d;
    });

  table.append('tbody')
    .selectAll('tr')
    .data(data.records)
    .enter()
    .append('tr')
    .selectAll('td')
    .data(row => data.columns.map((c) => {
      const val = row[c];
      let html;
      const isMetric = metrics.indexOf(c) >= 0;
      if (c === '__timestamp') {
        html = tsFormatter(val);
      }
      if (typeof (val) === 'string') {
        html = `<span class="like-pre">${val}</span>`;
      }
      if (isMetric) {
        html = slice.d3format(c, val);
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
        const perc = Math.round((d.val / maxes[d.col]) * 100);
        // The 0.01 to 0.001 is a workaround for what appears to be a
        // CSS rendering bug on flat, transparent colors
        return (
          `linear-gradient(to left, rgba(0,0,0,0.2), rgba(0,0,0,0.2) ${perc}%, ` +
          `rgba(0,0,0,0.01) ${perc}%, rgba(0,0,0,0.001) 100%)`
        );
      }
      return null;
    })
    .classed('text-right', d => d.isMetric)
    .attr('title', (d) => {
      if (!isNaN(d.val)) {
        return fC(d.val);
      }
      return null;
    })
    .attr('data-sort', function (d) {
      return (d.isMetric) ? d.val : null;
    })
    .on('click', function (d) {
      if (!d.isMetric && fd.table_filter) {
        const td = d3.select(this);
        if (td.classed('filtered')) {
          slice.removeFilter(d.col, [d.val]);
          d3.select(this).classed('filtered', false);
        } else {
          d3.select(this).classed('filtered', true);
          slice.addFilter(d.col, [d.val]);
        }
      }
    })
    .style('cursor', function (d) {
      return (!d.isMetric) ? 'pointer' : '';
    })
    .html(d => d.html ? d.html : d.val);
  const height = slice.height();
  let paging = false;
  let pageLength;
  if (fd.page_length && fd.page_length > 0) {
    paging = true;
    pageLength = parseInt(fd.page_length, 10);
  }
  const datatable = container.find('.dataTable').DataTable({
    paging,
    pageLength,
    aaSorting: [],
    searching: fd.include_search,
    bInfo: false,
    scrollY: height + 'px',
    scrollCollapse: true,
    scrollX: true,
  });
  fixDataTableBodyHeight(
      container.find('.dataTables_wrapper'), height);
  // Sorting table by main column
  if (metrics.length > 0) {
    const mainMetric = metrics[0];
    datatable.column(data.columns.indexOf(mainMetric)).order('desc').draw();
  }
  container.parents('.widget').find('.tooltip').remove();
}

module.exports = tableVis;
