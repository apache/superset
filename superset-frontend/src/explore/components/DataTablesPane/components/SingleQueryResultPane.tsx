/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState } from 'react';
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
  rowcount,
  datasourceId,
  dataSize = 50,
  isVisible,
  canDownload,
}: SingleQueryResultPaneProp) => {
  const [filterText, setFilterText] = useState('');

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    colnames,
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
        rowcount={rowcount}
        datasourceId={datasourceId}
        onInputChange={input => setFilterText(input)}
        isLoading={false}
        canDownload={canDownload}
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
