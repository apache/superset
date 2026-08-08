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
import rison from 'rison';
import { useQuery } from '@tanstack/react-query';
import { JsonObject, SupersetClient } from '@superset-ui/core';
import { queryClient } from 'src/queries/queryClient';
import { datasetKeys } from '../keys';

export interface DatasetListResult<T = JsonObject> {
  result: T[];
  count: number;
}

/**
 * Searches datasets (paginated). Imperative (the dataset AsyncSelect loader needs a
 * promise), so it uses fetchQuery rather than a hook. Generic over the row shape.
 */
export function fetchDatasetList<T = JsonObject>(
  query: string,
  resource: 'dataset' | 'datasource' = 'dataset',
): Promise<DatasetListResult<T>> {
  return queryClient.fetchQuery({
    queryKey: datasetKeys.list(query, resource),
    queryFn: async () => {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/${resource}/?q=${query}`,
      });
      return {
        result: (response.json.result ?? []) as T[],
        count: (response.json.count ?? 0) as number,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetches a dataset's metadata, optionally limited to a column projection. */
export async function fetchDatasetMetadata(
  datasetId: string | number,
  columns?: string[],
): Promise<JsonObject> {
  const query = columns ? `?q=${rison.encode({ columns })}` : '';
  const response = await SupersetClient.get({
    endpoint: `/api/v1/dataset/${datasetId}${query}`,
  });
  return (response.json as JsonObject).result as JsonObject;
}

/**
 * Reads dataset metadata (columns / metrics); repeated reads of the same dataset +
 * projection dedupe and share one cache.
 */
export function useDatasetMetadata(
  datasetId: string | number | null | undefined,
  columns?: string[],
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: datasetKeys.metadata(datasetId ?? '', columns),
    queryFn: () => fetchDatasetMetadata(datasetId as string | number, columns),
    enabled:
      datasetId != null && datasetId !== '' && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
