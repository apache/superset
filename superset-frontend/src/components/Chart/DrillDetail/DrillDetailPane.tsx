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
  ReactElement,
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
  GenericDataType,
} from '@superset-ui/core';
import { useResizeDetector } from 'react-resize-detector';
import Loading from 'src/components/Loading';
import BooleanCell from 'src/components/Table/cell-renderers/BooleanCell';
import NullCell from 'src/components/Table/cell-renderers/NullCell';
import TimeCell from 'src/components/Table/cell-renderers/TimeCell';
import { EmptyStateMedium } from 'src/components/EmptyState';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import Table, {
  ColumnsType,
  TablePaginationConfig,
  TableSize,
} from 'src/components/Table';
import MetadataBar, {
  ContentType,
  MetadataType,
} from 'src/components/MetadataBar';
import Alert from 'src/components/Alert';
import { useApiV1Resource } from 'src/hooks/apiResources';
import HeaderWithRadioGroup from 'src/components/Table/header-renderers/HeaderWithRadioGroup';
import TableControls from './DrillDetailTableControls';
import { getDrillPayload } from './utils';
import { Dataset, ResultsPage } from './types';

const PAGE_SIZE = 50;

interface DataType {
  [key: string]: any;
}

// Must be outside of the main component due to problems in
// react-resize-detector with conditional rendering
// https://github.com/maslianok/react-resize-detector/issues/178
function Resizable({ children }: { children: ReactElement }) {
  const { ref, height } = useResizeDetector();
  return (
    <div ref={ref} css={{ flex: 1 }}>
      {React.cloneElement(children, { height })}
    </div>
  );
}

enum TimeFormatting {
  Original,
  Formatted,
}

export default function DrillDetailPane({
  formData,
  initialFilters,
}: {
  formData: QueryFormData;
  initialFilters: BinaryQueryObjectFilterClause[];
}) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const lastPageIndex = useRef(pageIndex);
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [responseError, setResponseError] = useState('');
  const [resultsPages, setResultsPages] = useState<Map<number, ResultsPage>>(
    new Map(),
  );
  const [timeFormatting, setTimeFormatting] = useState({});

  const SAMPLES_ROW_LIMIT = useSelector(
    (state: { common: { conf: JsonObject } }) =>
      state.common.conf.SAMPLES_ROW_LIMIT,
  );

  // Extract datasource ID/type from string ID
  const [datasourceId, datasourceType] = useMemo(
    () => formData.datasource.split('__'),
    [formData.datasource],
  );

  // Get page of results
  const resultsPage = useMemo(() => {
    const nextResultsPage = resultsPages.get(pageIndex);
    if (nextResultsPage) {
      lastPageIndex.current = pageIndex;
      return nextResultsPage;
    }

    return resultsPages.get(lastPageIndex.current);
  }, [pageIndex, resultsPages]);

  const mappedColumns: ColumnsType<DataType> = useMemo(
    () =>
      resultsPage?.colNames.map((column, index) => ({
        key: column,
        dataIndex: column,
        title:
          resultsPage?.colTypes[index] === GenericDataType.TEMPORAL ? (
            <HeaderWithRadioGroup
              headerTitle={column}
              groupTitle={t('Formatting')}
              groupOptions={[
                { label: t('Original value'), value: TimeFormatting.Original },
                {
                  label: t('Formatted value'),
                  value: TimeFormatting.Formatted,
                },
              ]}
              value={
                timeFormatting[column] === TimeFormatting.Original
                  ? TimeFormatting.Original
                  : TimeFormatting.Formatted
              }
              onChange={value =>
                setTimeFormatting(state => ({ ...state, [column]: value }))
              }
            />
          ) : (
            column
          ),
        render: value => {
          if (value === true || value === false) {
            return <BooleanCell value={value} />;
          }
          if (value === null) {
            return <NullCell />;
          }
          if (
            resultsPage?.colTypes[index] === GenericDataType.TEMPORAL &&
            timeFormatting[column] !== TimeFormatting.Original &&
            (typeof value === 'number' || value instanceof Date)
          ) {
            return <TimeCell value={value} />;
          }
          return String(value);
        },
        width: 150,
      })) || [],
    [resultsPage?.colNames, resultsPage?.colTypes, timeFormatting],
  );

  const data: DataType[] = useMemo(
    () =>
      resultsPage?.data.map((row, index) =>
        resultsPage?.colNames.reduce(
          (acc, curr) => ({ ...acc, [curr]: row[curr] }),
          {
            key: index,
          },
        ),
      ) || [],
    [resultsPage?.colNames, resultsPage?.data],
  );

  // Clear cache on reload button click
  const handleReload = useCallback(() => {
    setResponseError('');
    setResultsPages(new Map());
    setPageIndex(0);
  }, []);

  // Clear cache and reset page index if filters change
  useEffect(() => {
    setResponseError('');
    setResultsPages(new Map());
    setPageIndex(0);
  }, [filters]);

  // Update cache order if page in cache
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

  // Download page of results & trim cache if page not in cache
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

  // Get datasource metadata
  const response = useApiV1Resource<Dataset>(`/api/v1/dataset/${datasourceId}`);

  const bootstrapping =
    (!responseError && !resultsPages.size) || response.status === 'loading';

  let tableContent = null;
  if (responseError) {
    // Render error if page download failed
    tableContent = (
      <pre
        css={css`
          margin-top: ${theme.gridUnit * 4}px;
        `}
      >
        {responseError}
      </pre>
    );
  } else if (bootstrapping) {
    // Render loading if first page hasn't loaded
    tableContent = <Loading />;
  } else if (resultsPage?.total === 0) {
    // Render empty state if no results are returned for page
    const title = t('No rows were returned for this dataset');
    tableContent = <EmptyStateMedium image="document.svg" title={title} />;
  } else {
    // Render table if at least one page has successfully loaded
    tableContent = (
      <Resizable>
        <Table
          data={data}
          columns={mappedColumns}
          size={TableSize.SMALL}
          defaultPageSize={PAGE_SIZE}
          recordCount={resultsPage?.total}
          usePagination
          loading={isLoading}
          onChange={(pagination: TablePaginationConfig) =>
            setPageIndex(pagination.current ? pagination.current - 1 : 0)
          }
          resizable
          virtualize
        />
      </Resizable>
    );
  }

  const metadata = useMemo(() => {
    const { status, result } = response;
    const items: ContentType[] = [];
    if (result) {
      const {
        changed_on_humanized,
        created_on_humanized,
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
        value: changed_on_humanized,
        modifiedBy,
      });
      items.push({
        type: MetadataType.OWNER,
        createdBy,
        owners: formattedOwners,
        createdOn: created_on_humanized,
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
        {status === 'complete' && (
          <MetadataBar items={items} tooltipPlacement="bottom" />
        )}
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
      {!bootstrapping && metadata}
      {!bootstrapping && (
        <TableControls
          filters={filters}
          setFilters={setFilters}
          totalCount={resultsPage?.total}
          loading={isLoading}
          onReload={handleReload}
        />
      )}
      {tableContent}
    </>
  );
}
