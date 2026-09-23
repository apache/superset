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
import {
  FC,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
import { Button, Loading, Tabs } from '@superset-ui/core/components';
import CodeSyntaxHighlighter, {
  SupportedLanguage,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { CopyToClipboard } from 'src/components';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import ViewQuery from 'src/explore/components/controls/ViewQuery';

const MAX_HIGHLIGHTED_RESPONSE_BYTES = 100 * 1024;

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

const LargeResponseContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;

  pre {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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
  const compactResponse =
    queriesResponse === null ? null : JSON.stringify(responses);
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
    responseBytes:
      compactResponse === null ? null : new Blob([compactResponse]).size,
    returnedRows,
    compactResponse,
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
  const [activeTabKey, setActiveTabKey] = useState('query');

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

  const responseStats = useMemo(
    () =>
      queriesResponse === undefined ? null : getResponseStats(queriesResponse),
    [queriesResponse],
  );

  const serializedResponse = useMemo(() => {
    if (
      !showResponse ||
      activeTabKey !== 'response' ||
      !queriesResponse?.length ||
      !responseStats
    ) {
      return null;
    }

    return JSON.stringify(queriesResponse, null, 2);
  }, [activeTabKey, queriesResponse, responseStats, showResponse]);

  if (queriesResponse === undefined || responseStats === null) {
    return queryContent;
  }

  const {
    cachedQueries,
    compactResponse,
    queryCount,
    responseBytes,
    returnedRows,
  } = responseStats;
  const isLargeResponse =
    responseBytes != null && responseBytes > MAX_HIGHLIGHTED_RESPONSE_BYTES;
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
              isLargeResponse ? (
                <LargeResponseContainer>
                  <CopyToClipboard
                    text={compactResponse ?? ''}
                    shouldShowText={false}
                    copyNode={
                      <Button buttonStyle="secondary" buttonSize="small">
                        {t('Copy')}
                      </Button>
                    }
                  />
                  <pre data-test="query-inspector-response-plain">
                    {serializedResponse}
                  </pre>
                </LargeResponseContainer>
              ) : (
                <CodeSyntaxHighlighter language="json" showLineNumbers>
                  {serializedResponse}
                </CodeSyntaxHighlighter>
              )
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
          <dd>
            {responseBytes == null
              ? t('Not available')
              : t('%s bytes', responseBytes.toLocaleString())}
          </dd>
          <dt
            title={t(
              'Time from chart update start until rendering completes; this is not query execution time.',
            )}
          >
            {t('Chart load time')}
          </dt>
          <dd>
            {duration == null ? t('Not available') : t('%s ms', duration)}
          </dd>
        </StatsGrid>
      ),
    },
  ];

  return (
    <Tabs
      fullHeight
      allowOverflow={false}
      activeKey={activeTabKey}
      onChange={setActiveTabKey}
      items={items}
    />
  );
};

export default ViewQueryModal;
