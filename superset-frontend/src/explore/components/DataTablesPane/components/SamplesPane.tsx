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
import { useState, useEffect, useMemo } from 'react';
import { ensureIsArray, GenericDataType, styled, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { EmptyStateMedium } from 'src/components/EmptyState';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import {
  useFilteredTableData,
  useTableColumns,
} from 'src/explore/components/DataTableControl';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import { TableControls } from './DataTableControls';
import { SamplesPaneProps } from '../types';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

const cache = new WeakSet();

export const SamplesPane = ({
  isRequest,
  datasource,
  queryForce,
  actions,
  dataSize = 50,
  isVisible,
  canDownload,
}: SamplesPaneProps) => {
  const [filterText, setFilterText] = useState('');
  const [data, setData] = useState<Record<string, any>[][]>([]);
  const [colnames, setColnames] = useState<string[]>([]);
  const [coltypes, setColtypes] = useState<GenericDataType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rowcount, setRowCount] = useState<number>(0);
  const [responseError, setResponseError] = useState<string>('');
  const datasourceId = useMemo(
    () => `${datasource.id}__${datasource.type}`,
    [datasource],
  );

  useEffect(() => {
    if (isRequest && queryForce) {
      cache.delete(datasource);
    }

    if (isRequest && !cache.has(datasource)) {
      setIsLoading(true);
      getDatasourceSamples(datasource.type, datasource.id, queryForce, {})
        .then(response => {
          setData(ensureIsArray(response.data));
          setColnames(ensureIsArray(response.colnames));
          setColtypes(ensureIsArray(response.coltypes));
          setRowCount(response.rowcount);
          setResponseError('');
          cache.add(datasource);
          if (queryForce && actions) {
            actions.setForceQuery(false);
          }
        })
        .catch(error => {
          setData([]);
          setColnames([]);
          setColtypes([]);
          setResponseError(`${error.name}: ${error.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [datasource, isRequest, queryForce]);

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

  if (isLoading) {
    return <Loading />;
  }

  if (responseError) {
    return (
      <>
        <TableControls
          data={filteredData}
          columnNames={colnames}
          columnTypes={coltypes}
          rowcount={rowcount}
          datasourceId={datasourceId}
          onInputChange={input => setFilterText(input)}
          isLoading={isLoading}
          canDownload={canDownload}
        />
        <Error>{responseError}</Error>
      </>
    );
  }

  if (data.length === 0) {
    const title = t('No samples were returned for this dataset');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }

  return (
    <>
      <TableControls
        data={filteredData}
        columnNames={colnames}
        columnTypes={coltypes}
        rowcount={rowcount}
        datasourceId={datasourceId}
        onInputChange={input => setFilterText(input)}
        isLoading={isLoading}
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
