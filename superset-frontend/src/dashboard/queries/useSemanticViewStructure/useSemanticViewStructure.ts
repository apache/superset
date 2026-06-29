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
import { useQuery } from '@tanstack/react-query';
import { SupersetClient } from '@superset-ui/core';
import { semanticViewKeys } from '../keys';

export interface SemanticViewDimension {
  name: string;
  type: string;
}

export interface SemanticViewMetric {
  name: string;
  definition: string;
}

export interface SemanticViewStructure {
  name: string;
  dimensions: SemanticViewDimension[];
  metrics: SemanticViewMetric[];
}

/** Fetches a semantic view's structure (dimensions / metrics). */
export async function fetchSemanticViewStructure(
  id: string | number,
): Promise<SemanticViewStructure> {
  const response = await SupersetClient.get({
    endpoint: `/api/v1/semantic_view/${id}/structure`,
  });
  const result = (response.json?.result ??
    {}) as Partial<SemanticViewStructure>;
  return {
    name: result.name ?? '',
    dimensions: result.dimensions ?? [],
    metrics: result.metrics ?? [],
  };
}

/**
 * Reads a semantic view's structure. Mirrors {@link useDatasetMetadata} so the
 * native-filter selects can source columns/metrics from either a dataset or a
 * semantic view behind the same query layer.
 */
export function useSemanticViewStructure(
  id: string | number | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: semanticViewKeys.structure(id ?? ''),
    queryFn: () => fetchSemanticViewStructure(id as string | number),
    enabled: id != null && id !== '' && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
