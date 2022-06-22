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
import { useState } from 'react';
import { isObject } from 'lodash';
import {
  SupersetClient,
  Query,
  runningQueryStateList,
} from '@superset-ui/core';
import { QueryDictionary } from 'src/SqlLab/types';
import useInterval from 'src/SqlLab/utils/useInterval';

const QUERY_UPDATE_FREQ = 2000;
const QUERY_UPDATE_BUFFER_MS = 5000;
const MAX_QUERY_AGE_TO_POLL = 21600000;
const QUERY_TIMEOUT_LIMIT = 10000;

interface RefreshQueriesFunc {
  (alteredQueries: any): any;
}

export interface QueryAutoRefreshProps {
  queries: QueryDictionary;
  refreshQueries: RefreshQueriesFunc;
  queriesLastUpdate: number;
}

// returns true if the Query.state matches one of the specifc values indicating the query is still processing on server
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
  refreshQueries,
  queriesLastUpdate,
}: QueryAutoRefreshProps) {
  // We do not want to spam requests in the case of slow connections and potentially recieve responses out of order
  // pendingRequest check ensures we only have one active http call to check for query statuses
  const [pendingRequest, setPendingRequest] = useState(false);

  const checkForRefresh = () => {
    if (!pendingRequest && shouldCheckForQueries(queries)) {
      setPendingRequest(true);
      SupersetClient.get({
        endpoint: `/superset/queries/${
          queriesLastUpdate - QUERY_UPDATE_BUFFER_MS
        }`,
        timeout: QUERY_TIMEOUT_LIMIT,
      })
        .then(({ json }) => {
          if (json) {
            refreshQueries?.(json);
          }
        })
        .catch(() => {})
        .finally(() => {
          setPendingRequest(false);
        });
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
