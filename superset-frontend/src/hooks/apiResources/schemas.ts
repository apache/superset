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

export type FetchSchemasQueryParams = {
  dbId?: string | number;
  forceRefresh?: boolean;
};

type QueryData = {
  json: { result: string[] };
  response: Response;
};

export type SchemaOption = {
  value: string;
  label: string;
  title: string;
};

export function fetchSchemas({ dbId, forceRefresh }: FetchSchemasQueryParams) {
  const queryParams = rison.encode({ force: forceRefresh });
  // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
  const endpoint = `/api/v1/database/${dbId}/schemas/?q=${queryParams}`;
  return SupersetClient.get({ endpoint }) as Promise<QueryData>;
}

type Params = FetchSchemasQueryParams &
  Pick<UseQueryOptions<SchemaOption[]>, 'onSuccess' | 'onError'>;

export function useSchemas(options: Params) {
  const { dbId, onSuccess, onError } = options || {};
  const forceRefreshRef = useRef(false);
  const params = { dbId };
  const result = useQuery<QueryData, Error, SchemaOption[]>(
    ['schemas', { dbId }],
    () => fetchSchemas({ ...params, forceRefresh: forceRefreshRef.current }),
    {
      select: ({ json }) =>
        json.result.map((value: string) => ({
          value,
          label: value,
          title: value,
        })),
      enabled: Boolean(dbId),
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
