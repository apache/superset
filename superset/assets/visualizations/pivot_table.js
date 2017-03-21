import { fixDataTableBodyHeight } from '../javascripts/modules/utils';
const $ = require('jquery');

require('./pivot_table.css');

require('datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
import 'datatables.net';
import dt from 'datatables.net-bs';
dt(window, $);

module.exports = function (slice, payload) {
  const container = slice.container;
  const fd = slice.formData;
  container.html(payload.data);
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
};
