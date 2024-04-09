// DODO was here
import React, { useState } from 'react';
import { t } from '@superset-ui/core';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import {
  useFilteredTableData,
  useTableColumns,
} from 'src/explore/components/DataTableControl';
import { TableControls } from './DataTableControls';
import { SingleQueryResultPaneProp } from '../types';

export const SingleQueryResultPane = ({
  data,
  colnames,
  coltypes,
  datasourceId,
  dataSize = 50,
  isVisible,
}: SingleQueryResultPaneProp) => {
  const [filterText, setFilterText] = useState('');

  // DODO changed
  const fixedColnames = colnames.map(name => (name === '' ? 'empty__' : name));

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    fixedColnames,
    coltypes,
    data,
    datasourceId,
    isVisible,
    {}, // moreConfig
    true, // allowHTML
  );
  const filteredData = useFilteredTableData(filterText, data);

  return (
    <>
      <TableControls
        data={filteredData}
        columnNames={colnames}
        columnTypes={coltypes}
        datasourceId={datasourceId}
        onInputChange={input => setFilterText(input)}
        isLoading={false}
      />
      <TableView
        columns={columns}
        data={filteredData}
        pageSize={dataSize}
        noDataText={t('No results')}
        emptyWrapperType={EmptyWrapperType.Small}
        className="table-condensed"
        isPaginationSticky
        showRowCount={false}
        small
      />
    </>
  );
};
