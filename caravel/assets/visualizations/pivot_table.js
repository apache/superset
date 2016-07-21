var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;

require('datatables.net-bs');
require('./pivot_table.css');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
var utils = require('../javascripts/modules/utils');

module.exports = function (slice) {
  var container = slice.container;

  function refresh() {
    $.getJSON(slice.jsonEndpoint(), function (json) {
      var form_data = json.form_data;
      container.html(json.data);
      if (form_data.groupby.length === 1) {
        var height = container.height();
        var table = container.find('table').DataTable({
          paging: false,
          searching: false,
          bInfo: false,
          scrollY: height + "px",
          scrollCollapse: true,
          scrollX: true,
        });
        table.column('-1').order('desc').draw();
        utils.fixDataTableBodyHeight(
            container.find('.dataTables_wrapper'), height);
      }
      slice.done(json);
    }).fail(function (xhr) {
      slice.error(xhr.responseText, xhr);
    });
  }
  return {
    render: refresh,
    resize: refresh,
  };
};
