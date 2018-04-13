import dt from 'datatables.net-bs';
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import $ from 'jquery';

import { d3format, fixDataTableBodyHeight } from '../javascripts/modules/utils';
import './pivot_table.css';

dt(window, $);

module.exports = function (slice, payload) {
  const container = slice.container;
  const fd = slice.formData;
  const height = container.height();
  let cols = payload.data.columns;
  if (Array.isArray(cols[0])) {
    cols = cols.map(col => col[0]);
  }

  // payload data is a string of html with a single table element
  container.html(payload.data.html);

  // jQuery hack to set verbose names in headers
  const replaceCell = function () {
    const s = $(this)[0].textContent;
    $(this)[0].textContent = slice.datasource.verbose_map[s] || s;
  };
  slice.container.find('thead tr:first th').each(replaceCell);
  slice.container.find('thead tr th:first-child').each(replaceCell);

  // jQuery hack to format number
  slice.container.find('tbody tr').each(function () {
    $(this).find('td').each(function (i) {
      const metric = cols[i];
      const format = slice.datasource.column_formats[metric] || fd.number_format || '.3s';
      const tdText = $(this)[0].textContent;
      if (!isNaN(tdText) && tdText !== '') {
        $(this)[0].textContent = d3format(format, tdText);
      }
    });
  });

  if (fd.groupby.length === 1) {
    // When there is only 1 group by column,
    // we use the DataTable plugin to make the header fixed.
    // The plugin takes care of the scrolling so we don't need
    // overflow: 'auto' on the table.
    container.css('overflow', 'hidden');
    const table = container.find('table').DataTable({
      paging: false,
      searching: false,
      bInfo: false,
      scrollY: `${height}px`,
      scrollCollapse: true,
      scrollX: true,
    });
    table.column('-1').order('desc').draw();
    fixDataTableBodyHeight(container.find('.dataTables_wrapper'), height);
  } else {
    // When there is more than 1 group by column we just render the table, without using
    // the DataTable plugin, so we need to handle the scrolling ourselves.
    // In this case the header is not fixed.
    container.css('overflow', 'auto');
    container.css('height', `${height + 10}px`);
  }
};
