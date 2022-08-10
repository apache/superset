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
import { useSelector } from 'react-redux';
import {
  BinaryQueryObjectFilterClause,
  css,
  ensureIsArray,
  GenericDataType,
  t,
  useTheme,
  QueryFormData,
  JsonObject,
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

export default function DrillDetailPane({
  formData,
  initialFilters,
}: {
  formData: QueryFormData;
  initialFilters?: BinaryQueryObjectFilterClause[];
}) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const lastPageIndex = useRef(pageIndex);
  const [filters, setFilters] = useState(initialFilters || []);
  const [isLoading, setIsLoading] = useState(false);
  const [responseError, setResponseError] = useState('');
  const [resultsPages, setResultsPages] = useState<Map<number, ResultsPage>>(
    new Map(),
  );

  const SAMPLES_ROW_LIMIT = useSelector(
    (state: { common: { conf: JsonObject } }) =>
      state.common.conf.SAMPLES_ROW_LIMIT,
  );

  //  Extract datasource ID/type from string ID
  const [datasourceId, datasourceType] = useMemo(
    () => formData.datasource.split('__'),
    [formData.datasource],
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
  const cachePageLimit = Math.ceil(SAMPLES_ROW_LIMIT / PAGE_SIZE);
  useEffect(() => {
    if (!isLoading && !resultsPages.has(pageIndex)) {
      setIsLoading(true);
      const jsonPayload = getDrillPayload(formData, filters);
      getDatasourceSamples(
        datasourceType,
        datasourceId,
        true,
        jsonPayload,
        PAGE_SIZE,
        pageIndex + 1,
      )
        .then(response => {
          setResultsPages(
            new Map([
              ...[...resultsPages.entries()].slice(-cachePageLimit + 1),
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
    cachePageLimit,
    datasourceId,
    datasourceType,
    filters,
    formData,
    isLoading,
    pageIndex,
    resultsPages,
  ]);

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    resultsPage?.colNames,
    resultsPage?.colTypes,
    resultsPage?.data,
    formData.datasource,
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

  let tableContent = null;

  if (responseError) {
    //  Render error if page download failed
    tableContent = (
      <div
        css={css`
          height: ${theme.gridUnit * 128}px;
        `}
      >
        <pre
          css={css`
            margin-top: ${theme.gridUnit * 4}px;
          `}
        >
          {responseError}
        </pre>
      </div>
    );
  } else if (!resultsPages.size) {
    //  Render loading if first page hasn't loaded
    tableContent = (
      <div
        css={css`
          height: ${theme.gridUnit * 128}px;
        `}
      >
        <Loading />
      </div>
    );
  } else if (resultsPage?.total === 0) {
    //  Render empty state if no results are returned for page
    const title = t('No rows were returned for this dataset');
    tableContent = (
      <div
        css={css`
          height: ${theme.gridUnit * 128}px;
        `}
      >
        <EmptyStateMedium image="document.svg" title={title} />
      </div>
    );
  } else {
    //  Render table if at least one page has successfully loaded
    tableContent = (
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
        `}
      />
    );
  }

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: ${theme.gridUnit * 128}px;
      `}
    >
      <TableControls
        filters={filters}
        setFilters={setFilters}
        totalCount={resultsPage?.total}
        loading={isLoading}
        onReload={handleReload}
      />
      {tableContent}
    </div>
  );
}
