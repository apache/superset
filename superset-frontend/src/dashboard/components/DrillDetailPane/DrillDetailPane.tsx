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
  BinaryQueryObjectFilterClause,
  css,
  ensureIsArray,
  GenericDataType,
  t,
  useTheme,
  QueryFormData,
} from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { EmptyStateMedium } from 'src/components/EmptyState';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { useTableColumns } from 'src/explore/components/DataTableControl';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import TableControls from './TableControls';
import { getDrillPayload } from './utils';

type ResultsPage = {
  total: number;
  data: Record<string, any>[];
  colNames: string[];
  colTypes: GenericDataType[];
};

const PAGE_SIZE = 50;
const MAX_CACHED_PAGES = 5;

export default function DrillDetailPane({
  datasource,
  queryFormData,
  drillFilters,
}: {
  datasource: string;
  queryFormData?: QueryFormData;
  drillFilters?: BinaryQueryObjectFilterClause[];
}) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const lastPageIndex = useRef(pageIndex);
  const [filters, setFilters] = useState(drillFilters || []);
  const [isLoading, setIsLoading] = useState(false);
  const [responseError, setResponseError] = useState('');
  const [resultsPages, setResultsPages] = useState<Map<number, ResultsPage>>(
    new Map(),
  );

  //  Get string identifier for dataset
  const [datasourceId, datasourceType] = useMemo(
    () => datasource.split('__'),
    [datasource],
  );

  //  Get page of results
  const resultsPage = useMemo(() => {
    const nextResultsPage = resultsPages.get(pageIndex);
    if (nextResultsPage) {
      lastPageIndex.current = pageIndex;
      return nextResultsPage;
    }

    return resultsPages.get(lastPageIndex.current);
  }, [pageIndex, resultsPages]);

  //  Clear cache and reset page index if filters change
  useEffect(() => {
    setResultsPages(new Map());
    setPageIndex(0);
  }, [filters]);

  //  Update cache order if page in cache
  useEffect(() => {
    if (
      resultsPages.has(pageIndex) &&
      [...resultsPages.keys()].at(-1) !== pageIndex
    ) {
      const nextResultsPages = new Map(resultsPages);
      nextResultsPages.delete(pageIndex);
      setResultsPages(
        nextResultsPages.set(
          pageIndex,
          resultsPages.get(pageIndex) as ResultsPage,
        ),
      );
    }
  }, [pageIndex, resultsPages]);

  //  Download page of results & trim cache if page not in cache
  useEffect(() => {
    if (!resultsPages.has(pageIndex)) {
      setIsLoading(true);
      const jsonPayload = getDrillPayload(queryFormData, drillFilters);
      getDatasourceSamples(datasourceType, datasourceId, true, jsonPayload, {
        page: pageIndex + 1,
        perPage: PAGE_SIZE,
      })
        .then(response => {
          setResultsPages(
            new Map([
              ...[...resultsPages.entries()].slice(-MAX_CACHED_PAGES + 1),
              [
                pageIndex,
                {
                  total: response.total_count,
                  data: response.data,
                  colNames: ensureIsArray(response.colnames),
                  colTypes: ensureIsArray(response.coltypes),
                },
              ],
            ]),
          );
          setResponseError('');
        })
        .catch(error => {
          setResponseError(`${error.name}: ${error.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [
    datasourceId,
    datasourceType,
    drillFilters,
    filters,
    pageIndex,
    queryFormData,
    resultsPages,
  ]);

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    resultsPage?.colNames,
    resultsPage?.colTypes,
    resultsPage?.data,
    datasource,
  );

  const sortDisabledColumns = columns.map(column => ({
    ...column,
    disableSortBy: true,
  }));

  //  Update page index on pagination click
  const onServerPagination = useCallback(({ pageIndex }) => {
    setPageIndex(pageIndex);
  }, []);

  //  Clear cache on reload button click
  const handleReload = useCallback(() => {
    setResultsPages(new Map());
  }, []);

  //  Render error if page download failed
  if (responseError) {
    return (
      <pre
        css={css`
          margin-top: ${theme.gridUnit * 4}px;
        `}
      >
        {responseError}
      </pre>
    );
  }

  //  Render loading if first page hasn't loaded
  if (!resultsPages.size) {
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

  //  Render empty state if no results are returned for page
  if (resultsPage?.total === 0) {
    const title = t('No rows were returned for this dataset');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }

  //  Render chart if at least one page has successfully loaded
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <TableControls
        filters={filters}
        setFilters={setFilters}
        totalCount={resultsPage?.total}
        onReload={handleReload}
      />
      <TableView
        columns={sortDisabledColumns}
        data={resultsPage?.data || []}
        pageSize={PAGE_SIZE}
        totalCount={resultsPage?.total}
        serverPagination
        initialPageIndex={pageIndex}
        onServerPagination={onServerPagination}
        loading={isLoading}
        noDataText={t('No results')}
        emptyWrapperType={EmptyWrapperType.Small}
        className="table-condensed"
        isPaginationSticky
        showRowCount={false}
        small
        css={css`
          min-height: 0;
          overflow: scroll;
          height: ${theme.gridUnit * 128}px;
        `}
      />
    </div>
  );
}
