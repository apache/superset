var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;

require('../stylesheets/dashed.css');
require('../stylesheets/welcome.css');
require('bootstrap');
require('datatables');
require('../node_modules/cal-heatmap/cal-heatmap.css');

var CalHeatMap = require('cal-heatmap');

function modelViewTable(selector, modelEndpoint, ordering) {
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
    $(selector).DataTable({
      aaData: tableData,
      aoColumns: cols,
      bPaginate: false,
      order: ordering,
      searching: false
    });
    $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
  });
}

$(document).ready(function () {
  var cal = new CalHeatMap();
  cal.init({
    start: new Date().setFullYear(new Date().getFullYear() - 1),
    range: 13,
    data: '/dashed/activity_per_day',
    domain: "month",
    subDomain: "day",
    itemName: "action",
    tooltip: true
  });
  modelViewTable('#dash_table', '/dashboardmodelviewasync');
  modelViewTable('#slice_table', '/sliceasync');
});
