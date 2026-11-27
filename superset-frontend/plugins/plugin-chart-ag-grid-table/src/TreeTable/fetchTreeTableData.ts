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
  BuildQueryFunction,
  ChartDataResponseResult,
  getClientErrorObject,
  JsonObject,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';

export type TreeTableQueryResult = Pick<
  ChartDataResponseResult,
  'data' | 'colnames' | 'coltypes' | 'rowcount' | 'sql_rowcount'
>;

export interface FetchTreeTableDataParams {
  formData: QueryFormData;
  buildQuery: BuildQueryFunction<QueryFormData>;
  ownState?: JsonObject;
  force?: boolean;
  signal?: AbortSignal;
}

// `results` never goes async (only `full` does), so the response is always
// a 200 with data, whether GLOBAL_ASYNC_QUERIES is on or off.
export default async function fetchTreeTableData({
  formData,
  buildQuery,
  ownState,
  force = false,
  signal,
}: FetchTreeTableDataParams): Promise<TreeTableQueryResult[]> {
  const jsonPayload = buildQuery(
    {
      ...formData,
      force,
      result_type: 'results',
      result_format: 'json',
    },
    { ownState },
  );
  try {
    const { json } = await SupersetClient.post({
      endpoint: '/api/v1/chart/data',
      jsonPayload,
      signal,
      parseMethod: 'json-bigint',
    });
    return json.result;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw error;
    }
    throw await getClientErrorObject(error);
  }
}
