/* eslint no-unused-vars: 0 */
import d3 from 'd3';
import dt from 'datatables.net-bs';
import 'datatables.net-bs/css/dataTables.bootstrap.css';

import '../stylesheets/welcome.css';
import { appSetup } from './common';

appSetup();

dt(window, $);

function modelViewTable(selector, modelView, orderCol, order) {
  // Builds a dataTable from a flask appbuilder api endpoint
  let url = '/' + modelView.toLowerCase() + '/api/read';
  url += '?_oc_' + modelView + '=' + orderCol;
  url += '&_od_' + modelView + '=' + order;
  $.getJSON(url, function (data) {
    const columns = ['dashboard_link', 'creator', 'modified'];
    const tableData = $.map(data.result, function (el) {
      const row = $.map(columns, function (col) {
        return el[col];
      });
      return [row];
    });
    const cols = $.map(columns, function (col) {
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
  modelViewTable('#dash_table', 'DashboardModelViewAsync', 'changed_on', 'desc');
});
