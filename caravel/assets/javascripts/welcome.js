const $ = window.$ = require('jquery');
/* eslint no-unused-vars: 0 */
const jQuery = window.jQuery = $;
require('../stylesheets/welcome.css');
require('bootstrap');
require('datatables.net-bs');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
require('../node_modules/cal-heatmap/cal-heatmap.css');
const d3 = require('d3');
const CalHeatMap = require('cal-heatmap');
function modelViewTable(selector, modelView, orderCol, order) {
  // Builds a dataTable from a flask appbuilder api endpoint
  let url = '/' + modelView.toLowerCase() + '/api/read';
  url += '?_oc_' + modelView + '=' + orderCol;
  url += '&_od_' + modelView + '=' + order;
  $.getJSON(url, function (data) {
    const tableData = $.map(data.result, function (el) {
      const row = $.map(data.list_columns, function (col) {
        return el[col];
      });
      return [row];
    });
    const cols = $.map(data.list_columns, function (col) {
      return { sTitle: data.label_columns[col] };
    });
    const panel = $(selector).parents('.panel');
    panel.find('img.loading').remove();
    $(selector).DataTable({
      aaData: tableData,
      aoColumns: cols,
      bPaginate: true,
      pageLength: 10,
      bLengthChange: false,
      aaSorting: [],
      searching: true,
      bInfo: false,
    });
    // Hack to move the searchbox in the right spot
    const search = panel.find('.dataTables_filter input');
    search.addClass('form-control').detach();
    search.appendTo(panel.find('.search'));
    panel.find('.dataTables_filter').remove();
    // Hack to display the page navigator properly
    panel.find('.col-sm-5').remove();
    const nav = panel.find('.col-sm-7');
    nav.removeClass('col-sm-7');
    nav.addClass('col-sm-12');
    $(selector).slideDown();
    $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
  });
}
$(document).ready(function () {
  d3.json('/caravel/activity_per_day', function (json) {
    const ext = d3.extent(d3.values(json));
    const cal = new CalHeatMap();
    const range = 10;
    const legendBounds = [];
    const step = (ext[1] - ext[0]) / (range - 1);
    for (let i = 0; i < range; i++) {
      legendBounds.push(i * step + ext[0]);
    }
    cal.init({
      start: new Date().setFullYear(new Date().getFullYear() - 1),
      range: 13,
      data: json,
      legend: legendBounds,
      legendColors: [
        '#D6E685',
        '#1E6823',
      ],
      domain: 'month',
      subDomain: 'day',
      itemName: 'action',
      tooltip: true,
      cellSize: 10,
      cellPadding: 2,
      domainGutter: 22,
    });
  });
  modelViewTable('#dash_table', 'DashboardModelViewAsync', 'changed_on', 'desc');
});
