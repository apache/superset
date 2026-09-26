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
import { useEffect, useRef, useState } from 'react';
import { DatasourceType } from '@superset-ui/core';
import {
  cachedSupersetGet,
  supersetGetCache,
} from 'src/utils/cachedSupersetGet';
import {
  fetchSemanticViewStructure,
  semanticViewDimensionsToColumns,
} from './FiltersConfigModal/FiltersConfigForm/utils';

/** The column fields display controls read to build their options. */
export interface DisplayControlColumn {
  column_name?: string;
  name?: string;
  verbose_name?: string | null;
  filterable?: boolean;
}

export interface DisplayControlDatasource {
  /** The datasource's display name (dataset table_name / semantic view name). */
  name: string | undefined;
  columns: DisplayControlColumn[];
  loading: boolean;
  /**
   * Set only while it belongs to the CURRENT (id, type) binding. The error
   * state lags a binding change by one render (the hook clears it in an
   * effect), so the hook gates it here rather than leak that timing to every
   * consumer — a stale failure from a previous binding never surfaces against
   * the new one.
   */
  error: Error | undefined;
}

/**
 * Stable identity for an (id, type) binding. Used by the hook to gate a lagging
 * error to the binding that produced it, and shared with consumers that need
 * the same key (e.g. de-duplicating a per-binding toast). Absent type resolves
 * to a regular dataset, matching the resolution branch.
 */
export const displayControlBindingKey = (
  datasetId: number | string,
  datasourceType?: DatasourceType,
): string => `${datasetId}__${datasourceType || DatasourceType.Table}`;

/**
 * The single, type-aware datasource resolution point for dashboard display
 * controls (Dynamic group by is the first adopter; siblings adopt this
 * hook as they gain loaders).
 *
 * Semantic views and regular datasets have independent numeric-id
 * sequences, so a binding must be resolved by BOTH id and datasourceType —
 * an id-only lookup silently reads whatever regular dataset shares the
 * view's number (sc-111089). The default branch preserves the legacy
 * display-control request (`GET /api/v1/dataset/<id>`, full resource, no
 * projection) byte-for-byte; changing that shape is a deliberate,
 * separately-tested decision, not a drive-by.
 *
 * Responses are guarded by a monotonic request id: on a same-id type flip
 * a slow response for the previous binding is discarded rather than
 * overwriting the newer one — reintroducing the wrong-object bug through
 * a race would otherwise be possible.
 */
export function useDisplayControlDatasource(
  datasetId: number | string | undefined | null,
  datasourceType?: DatasourceType,
): DisplayControlDatasource {
  const [name, setName] = useState<string | undefined>();
  const [columns, setColumns] = useState<DisplayControlColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [errorBinding, setErrorBinding] = useState<string | undefined>();
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Invalidate any in-flight request on every binding change (and on
    // unmount, via the cleanup below).
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!datasetId) {
      // Unbound control: inert, nothing to fetch. The falsy guard covers
      // undefined/null/'' and the legacy `0` null-sentinel that
      // migrateChartCustomization.extractDatasetId emits for an unresolvable
      // dataset (runs on dashboard hydrate) — restoring byte-identical legacy
      // behaviour and avoiding a spurious GET /api/v1/dataset/0 → 404 + toast.
      setName(undefined);
      setColumns([]);
      setLoading(false);
      setError(undefined);
      setErrorBinding(undefined);
      return undefined;
    }

    setLoading(true);
    setError(undefined);
    setErrorBinding(undefined);
    const binding = displayControlBindingKey(datasetId, datasourceType);

    const load = async (): Promise<{
      name: string | undefined;
      columns: DisplayControlColumn[];
    }> => {
      if (datasourceType === DatasourceType.SemanticView) {
        const structure = await fetchSemanticViewStructure(datasetId);
        return {
          name: structure.name,
          columns: semanticViewDimensionsToColumns(structure.dimensions),
        };
      }
      const endpoint = `/api/v1/dataset/${datasetId}`;
      try {
        const { json } = await cachedSupersetGet({ endpoint });
        return {
          name: json?.result?.table_name,
          columns: json?.result?.columns ?? [],
        };
      } catch (err) {
        // cachedSupersetGet caches the in-flight promise but never evicts a
        // rejected one, so a single 500 would poison this endpoint for the
        // whole page session — a later type-flip or retry would re-await the
        // same failure. Evict on rejection, mirroring the semantic-view branch
        // (sc-111089 review).
        supersetGetCache.delete(endpoint);
        throw err;
      }
    };

    load()
      .then(resolved => {
        if (requestId !== requestIdRef.current) return;
        setName(resolved.name);
        setColumns(resolved.columns);
      })
      .catch((err: Error) => {
        if (requestId !== requestIdRef.current) return;
        setName(undefined);
        setColumns([]);
        setError(err);
        setErrorBinding(binding);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [datasetId, datasourceType]);

  // Encapsulate the one-render error lag: `error`/`errorBinding` clear a render
  // after a binding change, so surface the error only while it still belongs to
  // the live binding. Consumers — and future adopters of this single resolution
  // point — then never have to re-derive that guard.
  const currentBinding = datasetId
    ? displayControlBindingKey(datasetId, datasourceType)
    : undefined;
  const scopedError = errorBinding === currentBinding ? error : undefined;

  return { name, columns, loading, error: scopedError };
}
