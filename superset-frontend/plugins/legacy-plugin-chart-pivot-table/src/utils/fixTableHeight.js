/**
 * Fix the height of the table body of a DataTable with scrollY set
 */
export default function fixTableHeight($tableDom, height) {
  const headHeight = $tableDom.find('.dataTables_scrollHead').height();
  const filterHeight = $tableDom.find('.dataTables_filter').height() || 0;
  const pageLengthHeight = $tableDom.find('.dataTables_length').height() || 0;
  const paginationHeight = $tableDom.find('.dataTables_paginate').height() || 0;
  const controlsHeight = pageLengthHeight > filterHeight ? pageLengthHeight : filterHeight;
  $tableDom
    .find('.dataTables_scrollBody')
    .css('max-height', height - headHeight - controlsHeight - paginationHeight);
}
