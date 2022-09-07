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
import MetadataBar, {
  ContentType,
  MetadataType,
} from 'src/components/MetadataBar';
import Alert from 'src/components/Alert';
import { useApiV1Resource } from 'src/hooks/apiResources';
import TableControls from './TableControls';
import { getDrillPayload } from './utils';
import { Dataset, ResultsPage } from './types';

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

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    resultsPage?.colNames,
    resultsPage?.colTypes,
    resultsPage?.data,
    formData.datasource,
  );

  //  Disable sorting on columns
  const sortDisabledColumns = useMemo(
    () =>
      columns.map(column => ({
        ...column,
        disableSortBy: true,
      })),
    [columns],
  );

  //  Update page index on pagination click
  const onServerPagination = useCallback(({ pageIndex }) => {
    setPageIndex(pageIndex);
  }, []);

  //  Clear cache on reload button click
  const handleReload = useCallback(() => {
    setResponseError('');
    setResultsPages(new Map());
    setPageIndex(0);
  }, []);

  //  Clear cache and reset page index if filters change
  useEffect(() => {
    setResponseError('');
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
    if (!responseError && !isLoading && !resultsPages.has(pageIndex)) {
      setIsLoading(true);
      const jsonPayload = getDrillPayload(formData, filters);
      const cachePageLimit = Math.ceil(SAMPLES_ROW_LIMIT / PAGE_SIZE);
      getDatasourceSamples(
        datasourceType,
        datasourceId,
        false,
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
    SAMPLES_ROW_LIMIT,
    datasourceId,
    datasourceType,
    filters,
    formData,
    isLoading,
    pageIndex,
    responseError,
    resultsPages,
  ]);

  let tableContent = null;
  if (responseError) {
    //  Render error if page download failed
    tableContent = (
      <pre
        css={css`
          margin-top: ${theme.gridUnit * 4}px;
        `}
      >
        {responseError}
      </pre>
    );
  } else if (!resultsPages.size) {
    //  Render loading if first page hasn't loaded
    tableContent = <Loading />;
  } else if (resultsPage?.total === 0) {
    //  Render empty state if no results are returned for page
    const title = t('No rows were returned for this dataset');
    tableContent = <EmptyStateMedium image="document.svg" title={title} />;
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
          overflow: auto;
          .table {
            margin-bottom: 0;
          }
        `}
      />
    );
  }

  // Get datasource metadata
  const response = useApiV1Resource<Dataset>(`/api/v1/dataset/${datasourceId}`);

  const metadata = useMemo(() => {
    const { status, result } = response;
    const items: ContentType[] = [];
    if (result) {
      const {
        changed_on,
        created_on,
        description,
        table_name,
        changed_by,
        created_by,
        owners,
      } = result;
      const notAvailable = t('Not available');
      const createdBy =
        `${created_by?.first_name ?? ''} ${
          created_by?.last_name ?? ''
        }`.trim() || notAvailable;
      const modifiedBy = changed_by
        ? `${changed_by.first_name} ${changed_by.last_name}`
        : notAvailable;
      const formattedOwners =
        owners.length > 0
          ? owners.map(owner => `${owner.first_name} ${owner.last_name}`)
          : [notAvailable];
      items.push({
        type: MetadataType.TABLE,
        title: table_name,
      });
      items.push({
        type: MetadataType.LAST_MODIFIED,
        value: changed_on,
        modifiedBy,
      });
      items.push({
        type: MetadataType.OWNER,
        createdBy,
        owners: formattedOwners,
        createdOn: created_on,
      });
      if (description) {
        items.push({
          type: MetadataType.DESCRIPTION,
          value: description,
        });
      }
    }
    return (
      <div
        css={css`
          display: flex;
          margin-bottom: ${theme.gridUnit * 4}px;
        `}
      >
        {status === 'loading' && <Loading position="inline-centered" />}
        {status === 'complete' && <MetadataBar items={items} />}
        {status === 'error' && (
          <Alert
            type="error"
            message={t('There was an error loading the dataset metadata')}
          />
        )}
      </div>
    );
  }, [response, theme.gridUnit]);

  return (
    <>
      {metadata}
      <TableControls
        filters={filters}
        setFilters={setFilters}
        totalCount={resultsPage?.total}
        loading={isLoading}
        onReload={handleReload}
      />
      {tableContent}
    </>
  );
}
