import { fixDataTableBodyHeight } from '../javascripts/modules/utils';
const $ = require('jquery');

require('datatables.net-bs');
require('./pivot_table.css');
require('datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');

module.exports = function (slice) {
  const container = slice.container;

  function refresh() {
    $.getJSON(slice.jsonEndpoint(), function (json) {
      const fd = json.form_data;
      container.html(json.data);
      if (fd.groupby.length === 1) {
        const height = container.height();
        const table = container.find('table').DataTable({
          paging: false,
          searching: false,
          bInfo: false,
          scrollY: height + 'px',
          scrollCollapse: true,
          scrollX: true,
        });
        table.column('-1').order('desc').draw();
        fixDataTableBodyHeight(
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
