var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;

require('datatables.net-bs');
require('./pivot_table.css');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');

module.exports = function (slice) {
  var container = slice.container;
  var form_data = slice.data.form_data;

  function refresh() {
    $.getJSON(slice.jsonEndpoint(), function (json) {
      container.html(json.data);
      if (form_data.groupby.length === 1) {
        var table = container.find('table').DataTable({
          paging: false,
          searching: false
        });
        table.column('-1').order('desc').draw();
      }
      slice.done(json);
    }).fail(function (xhr) {
      slice.error(xhr.responseText);
    });
  }
  return {
    render: refresh,
    resize: refresh
  };
};
