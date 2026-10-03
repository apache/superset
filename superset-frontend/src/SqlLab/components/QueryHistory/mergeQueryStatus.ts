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
import { concludedQueryStateList, QueryResponse } from '@superset-ui/core';

export const isConcludedState = (state: QueryResponse['state']) =>
  concludedQueryStateList.includes(state);

// The backend history snapshot fetched by `useEditorQueriesQuery` is a
// one-shot fetch that is never invalidated, so it can strand a query at a
// non-terminal state forever once `QueryAutoRefresh` stops polling it (see
// `QueryAutoRefresh.MAX_QUERY_AGE_TO_POLL`). This function corrects only
// that one case: when the live Redux copy has concluded and the snapshot
// has not, the live row supplies the status fields and both timestamps
// together, since they must come from a single clock (the backend records
// both `startDttm`/`endDttm` in server time, while the client stamps
// `endDttm` from the browser clock when a query concludes locally). Every
// other combination — including both sides concluded, or the snapshot
// already concluded — returns the snapshot row unchanged.
export const mergeQueryStatus = (
  remoteQuery: QueryResponse,
  localQuery: QueryResponse,
): QueryResponse => {
  if (
    !isConcludedState(localQuery.state) ||
    isConcludedState(remoteQuery.state)
  ) {
    return remoteQuery;
  }
  return {
    ...remoteQuery,
    state:
      localQuery.state !== undefined ? localQuery.state : remoteQuery.state,
    progress:
      localQuery.progress !== undefined
        ? localQuery.progress
        : remoteQuery.progress,
    rows: localQuery.rows !== undefined ? localQuery.rows : remoteQuery.rows,
    startDttm:
      localQuery.startDttm !== undefined
        ? localQuery.startDttm
        : remoteQuery.startDttm,
    endDttm:
      localQuery.endDttm !== undefined
        ? localQuery.endDttm
        : remoteQuery.endDttm,
    resultsKey:
      localQuery.resultsKey !== undefined
        ? localQuery.resultsKey
        : remoteQuery.resultsKey,
    errorMessage:
      localQuery.errorMessage !== undefined
        ? localQuery.errorMessage
        : remoteQuery.errorMessage,
  };
};
