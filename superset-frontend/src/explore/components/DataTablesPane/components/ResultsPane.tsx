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
import React, { useState, useEffect } from 'react';
import { ensureIsArray, GenericDataType, styled, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { EmptyStateMedium } from 'src/components/EmptyState';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import {
  useFilteredTableData,
  useTableColumns,
} from 'src/explore/components/DataTableControl';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { TableControls } from './DataTableControls';
import { ResultsPaneProps } from '../types';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

const cache = new WeakSet();

export const ResultsPane = ({
  isRequest,
  queryFormData,
  queryForce,
  ownState,
  errorMessage,
  actions,
  dataSize = 50,
}: ResultsPaneProps) => {
  const [filterText, setFilterText] = useState('');
  const [data, setData] = useState<Record<string, any>[][]>([]);
  const [colnames, setColnames] = useState<string[]>([]);
  const [coltypes, setColtypes] = useState<GenericDataType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [responseError, setResponseError] = useState<string>('');

  useEffect(() => {
    // it's an invalid formData when gets a errorMessage
    if (errorMessage) return;
    if (isRequest && !cache.has(queryFormData)) {
      setIsLoading(true);
      getChartDataRequest({
        formData: queryFormData,
        force: queryForce,
        resultFormat: 'json',
        resultType: 'results',
        ownState,
      })
        .then(({ json }) => {
          const { colnames, coltypes } = json.result[0];
          // Only displaying the first query is currently supported
          if (json.result.length > 1) {
            // todo: move these code to the backend, shouldn't loop by row in FE
            const data: any[] = [];
            json.result.forEach((item: { data: any[] }) => {
              item.data.forEach((row, i) => {
                if (data[i] !== undefined) {
                  data[i] = { ...data[i], ...row };
                } else {
                  data[i] = row;
                }
              });
            });
            setData(data);
            setColnames(colnames);
            setColtypes(coltypes);
          } else {
            setData(ensureIsArray(json.result[0].data));
            setColnames(colnames);
            setColtypes(coltypes);
          }
          setResponseError('');
          cache.add(queryFormData);
          if (queryForce && actions) {
            actions.setForceQuery(false);
          }
        })
        .catch(response => {
          getClientErrorObject(response).then(({ error, message }) => {
            setResponseError(error || message || t('Sorry, an error occurred'));
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [queryFormData, isRequest]);

  useEffect(() => {
    if (errorMessage) {
      setIsLoading(false);
    }
  }, [errorMessage]);

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    colnames,
    coltypes,
    data,
    queryFormData.datasource,
    isRequest,
  );
  const filteredData = useFilteredTableData(filterText, data);

  if (isLoading) {
    return <Loading />;
  }

  if (errorMessage) {
    const title = t('Run a query to display results');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }

  if (responseError) {
    return (
      <>
        <TableControls
          data={filteredData}
          columnNames={colnames}
          columnTypes={coltypes}
          datasourceId={queryFormData?.datasource}
          onInputChange={input => setFilterText(input)}
          isLoading={isLoading}
        />
        <Error>{responseError}</Error>
      </>
    );
  }

  if (data.length === 0) {
    const title = t('No results were returned for this query');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }

  return (
    <>
      <TableControls
        data={filteredData}
        columnNames={colnames}
        columnTypes={coltypes}
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
