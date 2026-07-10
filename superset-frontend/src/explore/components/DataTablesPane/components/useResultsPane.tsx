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
  ChartDataResponseResult,
  ensureIsArray,
  getChartMetadataRegistry,
  getClientErrorObject,
  QueryData,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
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

// `queriesResponse` is the loose `QueryData`; only reuse it when every entry is
// a full v1 result (colnames/coltypes/data arrays), else fall back to the API.
const isV1QueryResult = (query: QueryData): query is ChartDataResponseResult =>
  Array.isArray((query as ChartDataResponseResult).colnames) &&
  Array.isArray((query as ChartDataResponseResult).coltypes) &&
  Array.isArray((query as ChartDataResponseResult).data);

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
  queriesResponse,
}: ResultsPaneProps): ReactElement[] => {
  const metadata = getChartMetadataRegistry().get(
    queryFormData?.viz_type || queryFormData?.vizType,
  );

  const chartRowLimit = Number(queryFormData?.row_limit) || 10000;
  const [rowLimit, setRowLimit] = useState(1000);
  const [resultResp, setResultResp] = useState<QueryResultInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [responseError, setResponseError] = useState<string>('');
  const queryCount = metadata?.queryObjectCount ?? 1;
  const isQueryCountDynamic = metadata?.dynamicQueryObjectCount;

  const noOpInputChange = useCallback(() => {}, []);

  // Never exceed the chart's own row_limit
  const effectiveRowLimit = Math.min(rowLimit, chartRowLimit);

  const cappedFormData = useMemo(
    () => ({ ...queryFormData, row_limit: effectiveRowLimit }),
    [queryFormData, effectiveRowLimit],
  );

  const handleRowLimitChange = useCallback(
    (limit: number) => {
      setRowLimit(limit);
      cache.delete(cappedFormData);
    },
    [cappedFormData],
  );

  useEffect(() => {
    // it's an invalid formData when gets a errorMessage
    if (errorMessage) return;
    if (!isRequest) return;

    // The chart query and the results query produce identical SQL, so reuse the
    // chart's data instead of a second request. The chart always ran with a
    // row_limit >= effectiveRowLimit, so its first `effectiveRowLimit` rows
    // match what a dedicated results query would return — slice locally to keep
    // the row-limit dropdown working without a duplicate query.
    if (queriesResponse?.length && queriesResponse.every(isV1QueryResult)) {
      const mapped = queriesResponse.map(q => {
        const result = q as ChartDataResponseResult;
        const limitedData = ensureIsArray(result.data).slice(
          0,
          effectiveRowLimit,
        );
        return {
          colnames: result.colnames,
          coltypes: result.coltypes,
          data: limitedData,
          rowcount: limitedData.length,
        };
      }) as unknown as QueryResultInterface[];
      setResultResp(mapped);
      setResponseError('');
      if (queryForce) {
        setForceQuery?.(false);
      }
      setIsLoading(false);
      return;
    }

    // Fallback: use cached data
    if (cache.has(cappedFormData)) {
      setResultResp(
        ensureIsArray(cache.get(cappedFormData)) as QueryResultInterface[],
      );
      setResponseError('');
      if (queryForce) {
        setForceQuery?.(false);
      }
      setIsLoading(false);
      return;
    }

    // Fallback: fetch from API (legacy charts without queriesResponse)
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
  }, [cappedFormData, isRequest, queriesResponse, effectiveRowLimit]);

  useEffect(() => {
    if (errorMessage) {
      setIsLoading(false);
    }
  }, [errorMessage]);

  if (isLoading) {
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
        isVisible={isVisible ?? true}
        canDownload={canDownload}
        columnDisplayNames={columnDisplayNames}
        rowLimit={rowLimit}
        rowLimitOptions={ROW_LIMIT_OPTIONS}
        onRowLimitChange={handleRowLimitChange}
      />
    </StyledDiv>
  ));
};
