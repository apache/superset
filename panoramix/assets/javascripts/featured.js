var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;

require('datatables');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
require('bootstrap');

$(document).ready(function () {
  $('#dataset-table').DataTable({
    bPaginate: false,
    order: [
      [1, "asc"]
    ]
  });
  $('#dataset-table_info').remove();
  $('#dataset-table').show();
});
