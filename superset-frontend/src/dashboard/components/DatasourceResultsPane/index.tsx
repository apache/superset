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

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  css,
  Datasource,
  ensureIsArray,
  GenericDataType,
  QueryObjectFilterClause,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { EmptyStateMedium } from 'src/components/EmptyState';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { useTableColumns } from 'src/explore/components/DataTableControl';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import DatasourceFilterBar from './DatasourceFilterBar';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

const PAGE_SIZE = 50;

export default function DatasourceResultsPane({
  datasource,
  initialFilters,
}: {
  datasource: Datasource;
  initialFilters?: QueryObjectFilterClause[];
}) {
  const theme = useTheme();
  const pageResponses = useRef({});
  const [results, setResults] = useState<{
    total: number;
    dataPage: Record<string, any>[];
  } | null>();

  const [colnames, setColnames] = useState<string[]>([]);
  const [coltypes, setColtypes] = useState<GenericDataType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseError, setResponseError] = useState<string>('');
  const [filters, setFilters] = useState(initialFilters || []);
  const [page, setPage] = useState(0);
  const datasourceId = useMemo(
    () => `${datasource.id}__${datasource.type}`,
    [datasource],
  );

  useEffect(() => {
    pageResponses.current = {};
  }, [datasource, filters]);

  useEffect(() => {
    const getPageData = async () => {
      try {
        setIsLoading(true);
        let pageResponse = pageResponses.current[page];
        if (!pageResponse) {
          pageResponse = await getDatasourceSamples(
            datasource.type,
            datasource.id,
            true,
            filters.length ? filters : null,
            { page: page + 1, perPage: PAGE_SIZE },
          );

          pageResponses.current[page] = pageResponse;
        }

        setResults({
          total: pageResponse.total_count,
          dataPage: pageResponse.data,
        });

        setColnames(ensureIsArray(pageResponse.colnames));
        setColtypes(ensureIsArray(pageResponse.coltypes));
        setResponseError('');
      } catch (error) {
        setResults(null);
        setColnames([]);
        setColtypes([]);
        setResponseError(`${error.name}: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    getPageData();
  }, [page, datasource, filters]);

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    colnames,
    coltypes,
    results?.dataPage,
    datasourceId,
  );

  const onServerPagination = useCallback(({ pageIndex }) => {
    setPage(pageIndex);
  }, []);

  if (isLoading && !results) {
    return (
      <div
        css={css`
          height: ${theme.gridUnit * 25}px;
        `}
      >
        <Loading />
      </div>
    );
  }

  if (responseError) {
    return <Error>{responseError}</Error>;
  }

  if (!results || results.total === 0) {
    const title = t('No rows were returned for this dataset');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }

  return (
    <>
      <DatasourceFilterBar filters={filters} setFilters={setFilters} />
      <TableView
        columns={columns}
        data={results.dataPage}
        pageSize={PAGE_SIZE}
        totalCount={results.total}
        serverPagination
        initialPageIndex={page}
        onServerPagination={onServerPagination}
        loading={isLoading}
        noDataText={t('No results')}
        emptyWrapperType={EmptyWrapperType.Small}
        className="table-condensed"
        isPaginationSticky
        showRowCount={false}
        small
      />
    </>
  );
}
