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
import { FC, Fragment, useCallback, useEffect, useState } from 'react';

import { omit } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  getClientErrorObject,
  JsonObject,
  QueryData,
  QueryFormData,
} from '@superset-ui/core';
import { Alert } from '@apache-superset/core/components';
import { styled } from '@apache-superset/core/theme';
import { Loading, Tabs } from '@superset-ui/core/components';
import CodeSyntaxHighlighter, {
  SupportedLanguage,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import ViewQuery from 'src/explore/components/controls/ViewQuery';

interface Props {
  latestQueryFormData: QueryFormData;
  ownState?: JsonObject;
  queriesResponse?: QueryData[] | null;
  chartUpdateStartTime?: number;
  chartUpdateEndTime?: number | null;
  showResponse?: boolean;
}

type Result = {
  query?: string;
  language: SupportedLanguage;
  error?: string;
};

const ViewQueryModalContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const InspectorContainer = styled.div`
  height: 100%;

  .ant-tabs,
  .ant-tabs-content,
  .ant-tabs-tabpane {
    height: 100%;
  }

  .ant-tabs-tabpane {
    overflow: auto;
  }
`;

const StatsGrid = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 6}px;
  margin: 0;

  dt {
    color: ${({ theme }) => theme.colorTextSecondary};
  }

  dd {
    margin: 0;
  }
`;

const getResponseStats = (queriesResponse: QueryData[] | null) => {
  const responses = queriesResponse ?? [];
  const serializedResponse = JSON.stringify(responses, null, 2);
  const returnedRows = responses.reduce((total, response) => {
    const { data } = response as JsonObject;
    return total + (Array.isArray(data) ? data.length : 0);
  }, 0);
  const cachedQueries = responses.filter(
    response => (response as JsonObject).is_cached === true,
  ).length;

  return {
    cachedQueries,
    queryCount: responses.length,
    responseBytes: new Blob([JSON.stringify(responses)]).size,
    returnedRows,
    serializedResponse,
  };
};

const ViewQueryModal: FC<Props> = ({
  latestQueryFormData,
  ownState,
  queriesResponse,
  chartUpdateStartTime,
  chartUpdateEndTime,
  showResponse = false,
}) => {
  const [result, setResult] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChartData = useCallback(
    (resultType: string) => {
      setIsLoading(true);
      // Strip clientView (client-side row/column snapshot) from ownState before
      // requesting the query, matching the chart query path in ExploreViewContainer
      // and Dashboard's activeAllDashboardFilters. clientView is irrelevant to SQL
      // generation and can bloat the payload (or trigger 413) on large tables.
      const ownStateForQuery = omit(ownState, ['clientView']) || {};
      getChartDataRequest({
        formData: latestQueryFormData,
        resultFormat: 'json',
        resultType,
        ownState: ownStateForQuery,
      })
        .then(({ json }) => {
          setResult(ensureIsArray(json.result) as Result[]);
          setIsLoading(false);
          setError(null);
        })
        .catch(response => {
          getClientErrorObject(response).then(({ error, message }) => {
            setError(
              error ||
                message ||
                response.statusText ||
                t('Sorry, An error occurred'),
            );
            setIsLoading(false);
          });
        });
    },
    [latestQueryFormData, ownState],
  );
  useEffect(() => {
    loadChartData('query');
  }, [loadChartData]);

  const queryContent = isLoading ? (
    <Loading />
  ) : error ? (
    <pre>{error}</pre>
  ) : (
    <ViewQueryModalContainer>
      {result.map((item, index) => (
        // Static API response data - index is appropriate for keys
        <Fragment key={index}>
          {item.error && (
            <Alert type="error" message={item.error} closable={false} />
          )}
          {item.query && (
            <ViewQuery
              datasource={latestQueryFormData.datasource}
              sql={item.query}
              language={item.language}
            />
          )}
        </Fragment>
      ))}
    </ViewQueryModalContainer>
  );

  if (queriesResponse === undefined) {
    return queryContent;
  }

  const {
    cachedQueries,
    queryCount,
    responseBytes,
    returnedRows,
    serializedResponse,
  } = getResponseStats(queriesResponse);
  const duration =
    chartUpdateStartTime != null && chartUpdateEndTime != null
      ? Math.max(0, chartUpdateEndTime - chartUpdateStartTime)
      : null;
  const items = [
    {
      key: 'query',
      label: t('Query'),
      children: queryContent,
    },
    ...(showResponse
      ? [
          {
            key: 'response',
            label: t('Response'),
            children: queriesResponse?.length ? (
              <CodeSyntaxHighlighter language="json" showLineNumbers>
                {serializedResponse}
              </CodeSyntaxHighlighter>
            ) : (
              <p>{t('No response data is available yet.')}</p>
            ),
          },
        ]
      : []),
    {
      key: 'stats',
      label: t('Stats'),
      children: (
        <StatsGrid data-test="query-inspector-stats">
          <dt>{t('Queries')}</dt>
          <dd>{queryCount}</dd>
          <dt>{t('Returned rows')}</dt>
          <dd>{returnedRows}</dd>
          <dt>{t('Cached queries')}</dt>
          <dd>{cachedQueries}</dd>
          <dt>{t('Response size')}</dt>
          <dd>{t('%s bytes', responseBytes.toLocaleString())}</dd>
          <dt>{t('Duration')}</dt>
          <dd>
            {duration == null ? t('Not available') : t('%s ms', duration)}
          </dd>
        </StatsGrid>
      ),
    },
  ];

  return (
    <InspectorContainer>
      <Tabs items={items} />
    </InspectorContainer>
  );
};

export default ViewQueryModal;
