var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('./modules/dashed.js');

require('bootstrap');
require('datatables');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');

$(document).ready(function () {
  $('#dataset-table').DataTable({
    bPaginate: false,
    order: [
      [1, "asc"]
    ]
  });
  $('#dataset-table_info').remove();
  //$('input[type=search]').addClass('form-control');  # TODO get search box to look nice
  $('#dataset-table').show();
});
