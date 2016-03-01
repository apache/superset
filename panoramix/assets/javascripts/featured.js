var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
require('datatables');
require('datatables-bootstrap3-plugin');
require('bootstrap');

$(document).ready(function() {
  $('#dataset-table').DataTable({
    "bPaginate": false,
    "order": [
      [1, "asc"]
    ]
  });
  $('#dataset-table_info').remove();
  $('#dataset-table').show();
});
