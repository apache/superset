var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;

require('../stylesheets/caravel.css');
require('../stylesheets/welcome.css');
require('bootstrap');
require('datatables.net-bs');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
require('../node_modules/cal-heatmap/cal-heatmap.css');

var CalHeatMap = require('cal-heatmap');

function modelViewTable(selector, modelEndpoint) {
  // Builds a dataTable from a flask appbuilder api endpoint
  $.getJSON(modelEndpoint + '/api/read', function (data) {
    var tableData = jQuery.map(data.result, function (el, i) {
        var row = $.map(data.list_columns, function (col, i) {
          return el[col];
        });
        return [row];
    });
    var cols = jQuery.map(data.list_columns, function (col, i) {
      return { sTitle: data.label_columns[col] };
    });
    var panel = $(selector).parents('.panel');
    panel.find("img.loading").remove();
    $(selector).DataTable({
      aaData: tableData,
      aoColumns: cols,
      bPaginate: true,
      pageLength: 10,
      bLengthChange: false,
      aaSorting: [],
      searching: true
    });

    var search = panel.find(".dataTables_filter input");
    search.addClass('form-control').detach();
    search.appendTo(panel.find(".search"));
    panel.find('.dataTables_filter').remove();

    $(selector).slideDown();
    $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
  });
}

$(document).ready(function () {
  var cal = new CalHeatMap();
  cal.init({
    start: new Date().setFullYear(new Date().getFullYear() - 1),
    range: 13,
    data: '/caravel/activity_per_day',
    domain: "month",
    subDomain: "day",
    itemName: "action",
    tooltip: true
  });
  modelViewTable('#dash_table', '/dashboardmodelviewasync');
  modelViewTable('#slice_table', '/sliceasync');
});
