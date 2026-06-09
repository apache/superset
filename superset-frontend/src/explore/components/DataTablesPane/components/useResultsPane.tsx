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
import { useState, useEffect, useMemo, ReactElement, useCallback } from 'react';

import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  getChartMetadataRegistry,
  getClientErrorObject,
  QueryFormData,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import { ResultsPaneProps, QueryResultInterface } from '../types';
import { SingleQueryResultPane } from './SingleQueryResultPane';
import { TableControls, ROW_LIMIT_OPTIONS } from './DataTableControls';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.sizeUnit * 4}px`};
`;

const StyledDiv = styled.div`
  ${() => `
    display: flex;
    height: 100%;
    flex-direction: column;
    `}
`;

const cache = new WeakMap();

export const useResultsPane = ({
  isRequest,
  queryFormData,
  queryForce,
  ownState,
  errorMessage,
  setForceQuery,
  isVisible,
  canDownload,
  columnDisplayNames,
}: ResultsPaneProps): ReactElement[] => {
  const metadata = getChartMetadataRegistry().get(
    queryFormData?.viz_type || queryFormData?.vizType,
  );

  const chartRowLimit = Number(queryFormData?.row_limit) || 10000;
  const [rowLimit, setRowLimit] = useState(1000);
  const [orderby, setOrderby] = useState<[string, boolean][]>([]);
  // Server-side sort is only valid when the displayed columns map directly to
  // the SQL result. When the query has post-processing (e.g. pivot/cum/rolling),
  // `orderby` + `row_limit` are applied to the raw SQL *before* post-processing,
  // which changes the rows that feed those operations and corrupts the result.
  // In that case we fall back to client-side sorting of what the chart produced.
  const [hasPostProcessing, setHasPostProcessing] = useState(false);
  const [resultResp, setResultResp] = useState<QueryResultInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [responseError, setResponseError] = useState<string>('');
  const queryCount = metadata?.queryObjectCount ?? 1;
  const isQueryCountDynamic = metadata?.dynamicQueryObjectCount;

  const noOpInputChange = useCallback(() => {}, []);

  // Never exceed the chart's own row_limit
  const effectiveRowLimit = Math.min(rowLimit, chartRowLimit);

  const cappedFormData = useMemo(
    () => ({
      ...queryFormData,
      row_limit: effectiveRowLimit,
      // A new `orderby` produces a new object, missing the cache below and
      // triggering a server-side re-query in the sorted order.
      ...(orderby.length > 0 && { orderby }),
    }),
    [queryFormData, effectiveRowLimit, orderby],
  );

  const handleRowLimitChange = useCallback(
    (limit: number) => {
      setRowLimit(limit);
      cache.delete(cappedFormData);
    },
    [cappedFormData],
  );

  const handleServerSort = useCallback((nextOrderby: [string, boolean][]) => {
    setOrderby(nextOrderby);
  }, []);

  useEffect(() => {
    // it's an invalid formData when gets a errorMessage
    if (errorMessage) return;
    if (isRequest && cache.has(cappedFormData)) {
      setResultResp(
        ensureIsArray(cache.get(cappedFormData)) as QueryResultInterface[],
      );
      setResponseError('');
      if (queryForce) {
        setForceQuery?.(false);
      }
      setIsLoading(false);
    }
    if (isRequest && !cache.has(cappedFormData)) {
      setIsLoading(true);
      getChartDataRequest({
        formData: cappedFormData,
        force: queryForce,
        resultFormat: 'json',
        resultType: 'results',
        ownState,
      })
        .then(({ json }) => {
          setResultResp(ensureIsArray(json.result) as QueryResultInterface[]);
          setResponseError('');
          cache.set(cappedFormData, json.result);
          if (queryForce) {
            setForceQuery?.(false);
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
  }, [cappedFormData, isRequest]);

  useEffect(() => {
    if (errorMessage) {
      setIsLoading(false);
    }
  }, [errorMessage]);

  // Detect whether the chart's query uses post-processing so server-side sort
  // can be disabled for it. Building the payload is query construction only
  // (no network), and the result does not depend on `orderby`, so it is keyed
  // on the base form data rather than `cappedFormData`.
  useEffect(() => {
    let cancelled = false;
    buildV1ChartDataPayload({
      formData: queryFormData as QueryFormData,
      force: false,
      resultFormat: 'json',
      resultType: 'results',
    })
      .then(payload => {
        if (!cancelled) {
          setHasPostProcessing(
            ensureIsArray(payload?.queries).some(
              query => (query?.post_processing?.length ?? 0) > 0,
            ),
          );
        }
      })
      .catch(() => {
        // If the payload can't be built, fall back to disabling server sort to
        // avoid producing incorrect results.
        if (!cancelled) {
          setHasPostProcessing(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [queryFormData]);

  // Only replace the whole pane with a loader on the initial fetch. On a
  // re-sort/refetch we keep the existing pane mounted (with stale rows) so the
  // grid does not remount and lose its sort state; the loading state is surfaced
  // in-place instead.
  if (isLoading && resultResp.length === 0) {
    return Array(queryCount).fill(<Loading />);
  }

  if (errorMessage) {
    const title = t('Run a query to display results');
    return Array(queryCount).fill(
      <EmptyState image="document.svg" title={title} size="small" />,
    );
  }

  if (responseError) {
    const err = (
      <>
        <TableControls
          data={[]}
          columnNames={[]}
          columnTypes={[]}
          rowcount={0}
          datasourceId={queryFormData.datasource}
          onInputChange={noOpInputChange}
          isLoading={false}
          canDownload={canDownload}
        />
        <Error>{responseError}</Error>
      </>
    );
    return Array(queryCount).fill(err);
  }

  if (resultResp.length === 0) {
    const title = t('No results were returned for this query');
    return Array(queryCount).fill(
      <EmptyState image="document.svg" title={title} size="small" />,
    );
  }
  const resultRespToDisplay = isQueryCountDynamic
    ? resultResp
    : resultResp.slice(0, queryCount);

  return resultRespToDisplay.map((result, idx) => (
    <StyledDiv key={idx}>
      <SingleQueryResultPane
        data={result.data}
        colnames={result.colnames}
        coltypes={result.coltypes}
        rowcount={result.rowcount}
        datasourceId={queryFormData.datasource}
        isVisible={isVisible}
        canDownload={canDownload}
        columnDisplayNames={columnDisplayNames}
        rowLimit={rowLimit}
        rowLimitOptions={ROW_LIMIT_OPTIONS}
        onRowLimitChange={handleRowLimitChange}
        isLoading={isLoading}
        onServerSort={
          // Client-side sort is exact when the full result fits within the row
          // limit, so only re-query when the rows were truncated. Post-processed
          // queries are always sorted client-side, since server-side `orderby`
          // would change the rows feeding post-processing (see hasPostProcessing).
          !hasPostProcessing && result.rowcount >= effectiveRowLimit
            ? handleServerSort
            : undefined
        }
      />
    </StyledDiv>
  ));
};
