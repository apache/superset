import dt from 'datatables.net-bs';
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import $ from 'jquery';
import PropTypes from 'prop-types';
import { d3format, fixDataTableBodyHeight } from '../modules/utils';
import './pivot_table.css';

dt(window, $);

const propTypes = {
  data: PropTypes.shape({
    // TODO: replace this with raw data in SIP-6
    html: PropTypes.string,
    columns: PropTypes.arrayOf(PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ])),
  }),
  height: PropTypes.number,
  columnFormats: PropTypes.objectOf(PropTypes.string),
  groupBy: PropTypes.arrayOf(PropTypes.string),
  numberFormat: PropTypes.string,
  verboseMap: PropTypes.objectOf(PropTypes.string),
};

function PivotTable(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'PivotTable');

  const {
    data,
    height,
    columnFormats,
    groupBy,
    numberFormat,
    verboseMap,
  } = props;

  const { html, columns } = data;
  const container = element;
  const $container = $(element);

  // payload data is a string of html with a single table element
  container.innerHTML = html;

  const cols = Array.isArray(columns[0])
    ? columns.map(col => col[0])
    : columns;

  // jQuery hack to set verbose names in headers
  const replaceCell = function () {
    const s = $(this)[0].textContent;
    $(this)[0].textContent = verboseMap[s] || s;
  };
  $container.find('thead tr:first th').each(replaceCell);
  $container.find('thead tr th:first-child').each(replaceCell);

  // jQuery hack to format number
  $container.find('tbody tr').each(function () {
    $(this).find('td').each(function (i) {
      const metric = cols[i];
      const format = columnFormats[metric] || numberFormat || '.3s';
      const tdText = $(this)[0].textContent;
      if (!Number.isNaN(tdText) && tdText !== '') {
        $(this)[0].textContent = d3format(format, tdText);
        $(this).attr('data-sort', tdText);
      }
    });
  });

  if (groupBy.length === 1) {
    // When there is only 1 group by column,
    // we use the DataTable plugin to make the header fixed.
    // The plugin takes care of the scrolling so we don't need
    // overflow: 'auto' on the table.
    container.style.overflow = 'hidden';
    const table = $container.find('table').DataTable({
      paging: false,
      searching: false,
      bInfo: false,
      scrollY: `${height}px`,
      scrollCollapse: true,
      scrollX: true,
    });
    table.column('-1').order('desc').draw();
    fixDataTableBodyHeight($container.find('.dataTables_wrapper'), height);
  } else {
    // When there is more than 1 group by column we just render the table, without using
    // the DataTable plugin, so we need to handle the scrolling ourselves.
    // In this case the header is not fixed.
    container.style.overflow = 'auto';
    container.style.height = `${height + 10}px`;
  }
}

function adaptor(slice, payload) {
  const { selector, formData, datasource } = slice;
  const {
    groupby: groupBy,
    number_format: numberFormat,
  } = formData;
  const {
    column_formats: columnFormats,
    verbose_map: verboseMap,
  } = datasource;
  const element = document.querySelector(selector);

  return PivotTable(element, {
    data: payload.data,
    height: slice.height(),
    columnFormats,
    groupBy,
    numberFormat,
    verboseMap,
  });
}

export default adaptor;

