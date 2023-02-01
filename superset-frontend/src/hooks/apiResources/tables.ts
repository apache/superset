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
import { useQuery, UseQueryOptions } from 'react-query';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';

export type FetchTablesQueryParams = {
  dbId?: string | number;
  schema?: string;
  forceRefresh?: boolean;
};
export interface Table {
  label: string;
  value: string;
  type: string;
  extra?: {
    certification?: {
      certified_by: string;
      details: string;
    };
    warning_markdown?: string;
  };
}

type QueryData = {
  json: {
    count: number;
    result: Table[];
  };
  response: Response;
};

export type Data = {
  options: Table[];
  hasMore: boolean;
};

export function fetchTables({
  dbId,
  schema,
  forceRefresh,
}: FetchTablesQueryParams) {
  const encodedSchema = schema ? encodeURIComponent(schema) : '';
  const params = rison.encode({
    force: forceRefresh,
    schema_name: encodedSchema,
  });

  // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
  const endpoint = `/api/v1/database/${
    dbId ?? 'undefined'
  }/tables/?q=${params}`;
  return SupersetClient.get({ endpoint }) as Promise<QueryData>;
}

type Params = FetchTablesQueryParams &
  Pick<UseQueryOptions, 'onSuccess' | 'onError'>;

export function useTables(options: Params) {
  const { dbId, schema, onSuccess, onError } = options || {};
  const forceRefreshRef = useRef(false);
  const params = { dbId, schema };
  const result = useQuery<QueryData, Error, Data>(
    ['tables', { dbId, schema }],
    () => fetchTables({ ...params, forceRefresh: forceRefreshRef.current }),
    {
      select: ({ json }) => ({
        options: json.result,
        hasMore: json.count > json.result.length,
      }),
      enabled: Boolean(dbId && schema),
      onSuccess,
      onError,
      onSettled: () => {
        forceRefreshRef.current = false;
      },
    },
  );

  return {
    ...result,
    refetch: () => {
      forceRefreshRef.current = true;
      return result.refetch();
    },
  };
}
