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

import { omit } from 'lodash';
import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  getClientErrorObject,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { Alert } from '@apache-superset/core/components';
import { styled } from '@apache-superset/core/theme';
import { Loading } from '@superset-ui/core/components';
import { SupportedLanguage } from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import ViewQuery from 'src/explore/components/controls/ViewQuery';

interface Props {
  latestQueryFormData: QueryFormData;
  ownState?: JsonObject;
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

const ViewQueryModal: FC<Props> = ({ latestQueryFormData, ownState }) => {
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

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <pre>{error}</pre>;
  }

  return (
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
};

export default ViewQueryModal;
