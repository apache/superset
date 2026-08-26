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

/**
 * Column/metric metadata — and the dataset's own name — for the dataset a
 * widget is bound to, used by the reference controls in
 * `schemaControlRenderers.tsx`: `ColumnControl`/`MetricMultiControl` read the
 * columns and metrics, `DatasetControl` reads `tableName` for its picker's
 * label. Fetched from the same `/api/v1/dataset/<id>` endpoint V1 Explore
 * already uses — no backend work needed for this.
 */
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';

export interface DatasetColumnMeta {
  name: string;
  type: GenericDataType | null;
}

export interface DatasetMetricMeta {
  name: string;
  verboseName: string;
}

export interface DatasetMetadata {
  columns: DatasetColumnMeta[];
  metrics: DatasetMetricMeta[];
  tableName?: string;
}

interface RawDatasetColumn {
  column_name: string;
  type_generic?: GenericDataType | null;
}

interface RawDatasetMetric {
  metric_name: string;
  verbose_name?: string | null;
}

interface RawDatasetResult {
  columns?: RawDatasetColumn[];
  metrics?: RawDatasetMetric[];
  table_name?: string;
}

const cache = new Map<number, Promise<DatasetMetadata>>();

/**
 * Fetches a dataset's columns and metrics, cached per dataset id for the
 * lifetime of the page (the Inspector remounts controls on every selection
 * change; the underlying dataset rarely changes mid-edit).
 */
export function fetchDatasetMetadata(
  datasetId: number,
): Promise<DatasetMetadata> {
  const cached = cache.get(datasetId);
  if (cached) return cached;

  const promise = SupersetClient.get({
    endpoint: `/api/v1/dataset/${datasetId}`,
  })
    .then(({ json }) => {
      const { result } = json as { result: RawDatasetResult };
      return {
        columns: (result.columns ?? []).map(column => ({
          name: column.column_name,
          type: column.type_generic ?? null,
        })),
        metrics: (result.metrics ?? []).map(metric => ({
          name: metric.metric_name,
          verboseName: metric.verbose_name || metric.metric_name,
        })),
        tableName: result.table_name,
      };
    })
    .catch(error => {
      // Don't poison the cache with a transient failure — the next mount
      // should retry rather than fail open forever.
      cache.delete(datasetId);
      throw error;
    });

  cache.set(datasetId, promise);
  return promise;
}

/** Test-only: clears the module-level cache between test runs. */
export function resetDatasetMetadataCacheForTests(): void {
  cache.clear();
}

export interface DatasetMetadataState {
  metadata: DatasetMetadata | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: DatasetMetadataState = {
  metadata: null,
  loading: false,
  error: null,
};

/**
 * React hook wrapping `fetchDatasetMetadata`. Fails open: a fetch error
 * leaves `metadata` `null` rather than throwing, so a control can fall back
 * to a plain input instead of blocking the panel.
 */
export function useDatasetMetadata(
  datasetId: number | undefined,
): DatasetMetadataState {
  const [state, setState] = useState<DatasetMetadataState>(EMPTY_STATE);

  useEffect(() => {
    if (!datasetId) {
      setState(EMPTY_STATE);
      return undefined;
    }
    let cancelled = false;
    setState({ metadata: null, loading: true, error: null });
    fetchDatasetMetadata(datasetId)
      .then(metadata => {
        if (!cancelled) setState({ metadata, loading: false, error: null });
      })
      .catch(error => {
        if (!cancelled) {
          setState({
            metadata: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  return state;
}
