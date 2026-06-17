/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import type { DatasetSummary } from '../types';

/**
 * Fetch a lightweight list of datasets (id, name, database, columns)
 * for use in the relationship graph canvas.
 */
export function useDatasetList() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: '/api/v1/dataset/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:500)',
      });
      // The dataset list API returns { result: [...] }
      // Each dataset includes columns when accessed via this endpoint
      const result = (json as { result: DatasetSummary[] }).result;
      setDatasets(result);
    } catch (err) {
      addDangerToast('Error fetching datasets.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { datasets, loading, refresh: fetch };
}

/**
 * Fetch full dataset details (including columns) for specific dataset IDs.
 * Returns enriched dataset objects with columns populated.
 */
export function useDatasetColumnsEnricher() {
  const cacheRef = useRef<Map<number, DatasetSummary>>(new Map());

  const enrichDatasets = useCallback(
    async (datasets: DatasetSummary[]): Promise<DatasetSummary[]> => {
      const toFetch = datasets.filter(
        d => !d.columns || d.columns.length === 0,
      );

      if (toFetch.length === 0) return datasets;

      const results = await Promise.allSettled(
        toFetch.map(async ds => {
          // Check cache first
          if (cacheRef.current.has(ds.id)) {
            return cacheRef.current.get(ds.id)!;
          }
          const { json } = await SupersetClient.get({
            endpoint: `/api/v1/dataset/${ds.id}`,
          });
          const full = (json as { result: DatasetSummary }).result ?? (json as DatasetSummary);
          cacheRef.current.set(ds.id, full);
          return full;
        }),
      );

      // Build enriched map
      const enrichedMap = new Map<number, DatasetSummary>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          enrichedMap.set(toFetch[i].id, r.value);
        }
      });

      return datasets.map(ds => enrichedMap.get(ds.id) ?? ds);
    },
    [],
  );

  return { enrichDatasets };
}

/**
 * Fetch a single dataset with full column info.
 */
export function useDataset(datasetId: number | null) {
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (datasetId === null) {
      setDataset(null);
      return;
    }
    setLoading(true);
    SupersetClient.get({
      endpoint: `/api/v1/dataset/${datasetId}`,
    })
      .then(({ json }) => {
        setDataset(json as DatasetSummary);
      })
      .catch(() => {
        addDangerToast('Error fetching dataset.');
      })
      .finally(() => setLoading(false));
  }, [datasetId]);

  return { dataset, loading };
}
