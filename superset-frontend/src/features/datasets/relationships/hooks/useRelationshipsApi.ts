/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain the copy of the License at
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

import { useState, useEffect, useCallback } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { filterTranslationEngine } from '../filterTranslation';
import type {
  DatasetRelationship,
  DatasetRelationshipCreate,
  DatasetRelationshipUpdate,
  RelationshipListResponse,
  RelationshipCreateResponse,
} from '../types';

const API_BASE = '/api/v1/dataset_relationship';

// ---------------------------------------------------------------------------
// GET all relationships (optionally for a dataset)
// ---------------------------------------------------------------------------

export function useRelationships(datasetId?: number) {
  const [relationships, setRelationships] = useState<DatasetRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = datasetId
        ? `${API_BASE}/dataset/${datasetId}`
        : `${API_BASE}/`;
      const { json } = await SupersetClient.get({ endpoint });
      setRelationships((json as RelationshipListResponse).result);
    } catch (err) {
      addDangerToast('Error fetching dataset relationships.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { relationships, loading, refresh: fetch };
}

// ---------------------------------------------------------------------------
// GET single relationship
// ---------------------------------------------------------------------------

export function useRelationship(relationshipId: number | null) {
  const [relationship, setRelationship] = useState<DatasetRelationship | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (relationshipId === null) {
      setRelationship(null);
      return;
    }
    setLoading(true);
    SupersetClient.get({ endpoint: `${API_BASE}/${relationshipId}` })
      .then(({ json }) => {
        setRelationship((json as { result: DatasetRelationship }).result);
      })
      .catch(() => {
        addDangerToast('Error fetching relationship.');
      })
      .finally(() => setLoading(false));
  }, [relationshipId]);

  return { relationship, loading };
}

// ---------------------------------------------------------------------------
// POST create relationship
// ---------------------------------------------------------------------------

export function useCreateRelationship() {
  const [loading, setLoading] = useState(false);

  const create = useCallback(
    async (data: DatasetRelationshipCreate): Promise<DatasetRelationship> => {
      setLoading(true);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `${API_BASE}/`,
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' },
        });
        const resp = json as RelationshipCreateResponse;
        // Invalidate cache for involved datasets
        filterTranslationEngine.invalidateDataset(data.source_dataset_id);
        filterTranslationEngine.invalidateDataset(data.target_dataset_id);
        // Fetch full relationship
        const { json: fullJson } = await SupersetClient.get({
          endpoint: `${API_BASE}/${resp.id}`,
        });
        return (fullJson as { result: DatasetRelationship }).result;
      } catch (err) {
        addDangerToast('Error creating relationship.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { create, loading };
}

// ---------------------------------------------------------------------------
// PUT update relationship
// ---------------------------------------------------------------------------

export function useUpdateRelationship() {
  const [loading, setLoading] = useState(false);

  const update = useCallback(
    async (
      id: number,
      data: DatasetRelationshipUpdate,
    ): Promise<DatasetRelationship> => {
      setLoading(true);
      try {
        await SupersetClient.put({
          endpoint: `${API_BASE}/${id}`,
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' },
        });
        const { json } = await SupersetClient.get({
          endpoint: `${API_BASE}/${id}`,
        });
        const result = (json as { result: DatasetRelationship }).result;
        // Invalidate cache for involved datasets
        filterTranslationEngine.invalidateDataset(result.source_dataset_id);
        filterTranslationEngine.invalidateDataset(result.target_dataset_id);
        return result;
      } catch (err) {
        addDangerToast('Error updating relationship.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { update, loading };
}

// ---------------------------------------------------------------------------
// DELETE relationship
// ---------------------------------------------------------------------------

export function useDeleteRelationship() {
  const [loading, setLoading] = useState(false);

  const remove = useCallback(async (id: number): Promise<void> => {
    setLoading(true);
    try {
      // Fetch before delete to get dataset IDs for cache invalidation
      const { json } = await SupersetClient.get({
        endpoint: `${API_BASE}/${id}`,
      });
      const rel = (json as { result: DatasetRelationship }).result;
      await SupersetClient.delete({ endpoint: `${API_BASE}/${id}` });
      filterTranslationEngine.invalidateDataset(rel.source_dataset_id);
      filterTranslationEngine.invalidateDataset(rel.target_dataset_id);
    } catch (err) {
      addDangerToast('Error deleting relationship.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading };
}
