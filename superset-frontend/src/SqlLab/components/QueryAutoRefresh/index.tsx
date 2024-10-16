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
import { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { isObject } from 'lodash';
import rison from 'rison';
import {
  SupersetClient,
  Query,
  runningQueryStateList,
  QueryResponse,
} from '@superset-ui/core';
import { QueryDictionary } from 'src/SqlLab/types';
import useInterval from 'src/SqlLab/utils/useInterval';
import {
  refreshQueries,
  clearInactiveQueries,
} from 'src/SqlLab/actions/sqlLab';

export const QUERY_UPDATE_FREQ = 2000;
const QUERY_UPDATE_BUFFER_MS = 5000;
const MAX_QUERY_AGE_TO_POLL = 21600000;
const QUERY_TIMEOUT_LIMIT = 10000;

export interface QueryAutoRefreshProps {
  queries: QueryDictionary;
  queriesLastUpdate: number;
}

// returns true if the Query.state matches one of the specific values indicating the query is still processing on server
export const isQueryRunning = (q: Query): boolean =>
  runningQueryStateList.includes(q?.state);

// returns true if at least one query is running and within the max age to poll timeframe
export const shouldCheckForQueries = (queryList: QueryDictionary): boolean => {
  let shouldCheck = false;
  const now = Date.now();
  if (isObject(queryList)) {
    shouldCheck = Object.values(queryList).some(
      q => isQueryRunning(q) && now - q?.startDttm < MAX_QUERY_AGE_TO_POLL,
    );
  }
  return shouldCheck;
};

function QueryAutoRefresh({
  queries,
  queriesLastUpdate,
}: QueryAutoRefreshProps) {
  // We do not want to spam requests in the case of slow connections and potentially receive responses out of order
  // pendingRequest check ensures we only have one active http call to check for query statuses
  const pendingRequestRef = useRef(false);
  const cleanInactiveRequestRef = useRef(false);
  const dispatch = useDispatch();

  const checkForRefresh = () => {
    const shouldRequestChecking = shouldCheckForQueries(queries);
    if (!pendingRequestRef.current && shouldRequestChecking) {
      const params = rison.encode({
        last_updated_ms: queriesLastUpdate - QUERY_UPDATE_BUFFER_MS,
      });

      const controller = new AbortController();
      pendingRequestRef.current = true;
      SupersetClient.get({
        endpoint: `/api/v1/query/updated_since?q=${params}`,
        timeout: QUERY_TIMEOUT_LIMIT,
        parseMethod: 'json-bigint',
        signal: controller.signal,
      })
        .then(({ json }) => {
          if (json) {
            const jsonPayload = json as { result?: QueryResponse[] };
            if (jsonPayload?.result?.length) {
              const queries =
                jsonPayload?.result?.reduce(
                  (acc: Record<string, QueryResponse>, current) => {
                    acc[current.id] = current;
                    return acc;
                  },
                  {},
                ) ?? {};
              dispatch(refreshQueries(queries));
            } else {
              dispatch(clearInactiveQueries(QUERY_UPDATE_FREQ));
            }
          }
        })
        .catch(() => {
          controller.abort();
        })
        .finally(() => {
          pendingRequestRef.current = false;
        });
    }
    if (!cleanInactiveRequestRef.current && !shouldRequestChecking) {
      dispatch(clearInactiveQueries(QUERY_UPDATE_FREQ));
      cleanInactiveRequestRef.current = true;
    }
  };

  // Solves issue where direct usage of setInterval in function components
  // uses stale props / state from closure
  // See comments in the useInterval.ts file for more information
  useInterval(() => {
    checkForRefresh();
  }, QUERY_UPDATE_FREQ);

  return null;
}

export default QueryAutoRefresh;
