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
import { DataRecord, GenericDataType } from '@superset-ui/core';
import { useCallback, useEffect, useState } from 'react';
import { isEqual } from 'lodash';
import { AgGridTableChartTransformedProps, SearchOption } from './types';
import AgGridDataTable from './AgGridTable';
import { InputColumn, transformData } from './AgGridTable/transformData';
import { updateTableOwnState } from './utils/externalAPIs';

const getGridHeight = (height: number, serverPagination: boolean) => {
  let calculatedGridHeight = height;
  if (serverPagination) {
    calculatedGridHeight -= 80;
  }
  return calculatedGridHeight;
};

export default function TableChart<D extends DataRecord = DataRecord>(
  props: AgGridTableChartTransformedProps<D> & {},
) {
  const {
    height,
    columns,
    data,
    includeSearch,
    allowRearrangeColumns,
    pageSize,
    serverPagination,
    rowCount,
    setDataMask,
    serverPaginationData,
    slice_id,
  } = props;

  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);

  useEffect(() => {
    const options = columns
      .filter(col => col?.dataType === GenericDataType.String)
      .map(column => ({
        value: column.key,
        label: column.label,
      }));

    if (!isEqual(options, searchOptions)) {
      setSearchOptions(options || []);
    }
  }, [columns]);

  const transformedData = transformData(columns as InputColumn[], data);
  const gridHeight = getGridHeight(height, serverPagination);

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: 0,
        pageSize,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  const handleChangeSearchCol = (searchCol: string) => {
    if (!isEqual(searchCol, serverPaginationData?.searchColumn)) {
      const modifiedOwnState = {
        ...(serverPaginationData || {}),
        searchColumn: searchCol,
        searchText: '',
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  };

  const handleSearch = useCallback(
    (searchText: string) => {
      const modifiedOwnState = {
        ...(serverPaginationData || {}),
        searchColumn:
          serverPaginationData?.searchColumn || searchOptions[0]?.value,
        searchText,
        currentPage: 0, // Reset to first page when searching
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, searchOptions],
  );

  return (
    <div
      style={{
        height,
      }}
    >
      <AgGridDataTable
        gridHeight={gridHeight}
        data={transformedData?.rowData || []}
        colDefsFromProps={transformedData?.colDefs}
        includeSearch={!!includeSearch}
        allowRearrangeColumns={!!allowRearrangeColumns}
        pagination={!!pageSize && !serverPagination}
        pageSize={pageSize || 0}
        serverPagination={serverPagination}
        rowCount={rowCount}
        onServerPaginationChange={handleServerPaginationChange}
        onServerPageSizeChange={handlePageSizeChange}
        serverPaginationData={serverPaginationData}
        searchOptions={searchOptions}
        onSearchColChange={handleChangeSearchCol}
        onSearchChange={handleSearch}
        id={slice_id}
      />
    </div>
  );
}
