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
import React, { useState } from 'react';
import { styled, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { EmptyStateMedium } from 'src/components/EmptyState';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import {
  useFilteredTableData,
  useTableColumns,
} from 'src/explore/components/DataTableControl';
import { useOriginalFormattedTimeColumns } from 'src/explore/components/useOriginalFormattedTimeColumns';
import { TableControls } from './DataTableControls';
import { useGetResultsOrSamples } from './utils';
import { DataTableProps } from './types';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

export const DataTable = ({
  isRequest,
  resultType,
  queryFormData,
  datasource,
  queryForce,
  ownState,
  errorMessage,
  actions,
  dataSize = 50,
}: DataTableProps) => {
  const [filterText, setFilterText] = useState('');
  const { isLoading, data, colnames, coltypes, responseError } =
    useGetResultsOrSamples({
      isRequest: isRequest && !errorMessage,
      resultType,
      datasource,
      queryFormData,
      queryForce,
      ownState,
      actions,
    });

  const originalFormattedTimeColumns = useOriginalFormattedTimeColumns(
    queryFormData.datasource,
  );
  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    colnames,
    coltypes,
    data,
    queryFormData.datasource,
    originalFormattedTimeColumns,
  );
  const filteredData = useFilteredTableData(filterText, data);

  if (isLoading) {
    return <Loading />;
  }

  if (errorMessage && resultType === 'results') {
    const title = t('Run a query to display results');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }

  if (responseError) {
    return (
      <>
        <TableControls
          data={filteredData}
          columnNames={colnames}
          datasourceId={queryFormData?.datasource}
          onInputChange={input => setFilterText(input)}
          isLoading={isLoading}
        />
        <Error>{responseError}</Error>
      </>
    );
  }

  if (data.length === 0) {
    const title =
      resultType === 'samples'
        ? t('No samples were returned for this query')
        : t('No results were returned for this query');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }

  return (
    <>
      <TableControls
        data={filteredData}
        columnNames={colnames}
        datasourceId={queryFormData?.datasource}
        onInputChange={input => setFilterText(input)}
        isLoading={isLoading}
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
