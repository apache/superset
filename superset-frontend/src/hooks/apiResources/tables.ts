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
import { useEffect, useState } from 'react';
import { useQuery, UseQueryOptions } from 'react-query';
import { SupersetClient } from '@superset-ui/core';

export type FetchTablesQueryParams = {
  dbId?: string | number;
  schema?: string;
  forceRefresh?: boolean;
};

export function fetchTables({
  dbId,
  schema,
  forceRefresh,
}: FetchTablesQueryParams) {
  const encodedSchema = schema ? encodeURIComponent(schema) : '';
  // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
  const endpoint = `/superset/tables/${
    dbId ?? 'undefined'
  }/${encodedSchema}/undefined/${forceRefresh}/`;
  return SupersetClient.get({ endpoint });
}

type Params = FetchTablesQueryParams &
  Pick<UseQueryOptions, 'onSuccess' | 'onError'>;

export function useTables(options: Params) {
  const { dbId, schema, onSuccess, onError } = options || {};
  const [forceRefresh, setForceRefresh] = useState(false);
  const params = { dbId, schema, forceRefresh };
  const result = useQuery(
    ['tables', { dbId, schema }],
    () => fetchTables(params),
    {
      select: ({ json }) => json.options,
      enabled: Boolean(dbId && schema),
      onSuccess,
      onError,
    },
  );

  const { isFetched } = result;

  useEffect(() => {
    if (isFetched) {
      setForceRefresh(true);
    }
  }, [isFetched]);

  return result;
}
