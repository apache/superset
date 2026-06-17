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

import { useState, useCallback } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';

/**
 * Relationship-related metadata stored in dashboard json_metadata.
 */
export interface DashboardRelationshipMetadata {
  /** Relationship IDs that are active for this dashboard */
  active_relationships: number[];
  /** Drill-down hierarchy configurations */
  drill_down_hierarchies: Array<{
    id: string;
    name: string;
    levels: Array<{
      dataset_id: number;
      column_name: string;
      label: string;
    }>;
  }>;
}

/**
 * Hook to read/write relationship metadata in dashboard json_metadata.
 */
export function useDashboardRelationshipMetadata(
  dashboardId: number | null,
  initialMetadata?: DashboardRelationshipMetadata,
) {
  const [metadata, setMetadata] = useState<DashboardRelationshipMetadata>(
    initialMetadata ?? {
      active_relationships: [],
      drill_down_hierarchies: [],
    },
  );

  const updateMetadata = useCallback(
    async (patch: Partial<DashboardRelationshipMetadata>) => {
      if (!dashboardId) return;
      const updated = { ...metadata, ...patch };
      try {
        // Fetch current json_metadata, merge, and save back
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboardId}`,
        });
        const currentMetadata = JSON.parse(json.result.json_metadata || '{}');
        currentMetadata.relationship_config = updated;
        await SupersetClient.put({
          endpoint: `/api/v1/dashboard/${dashboardId}`,
          body: JSON.stringify({
            json_metadata: JSON.stringify(currentMetadata),
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        setMetadata(updated);
      } catch {
        addDangerToast('Error saving dashboard relationship configuration.');
      }
    },
    [dashboardId, metadata],
  );

  const toggleRelationship = useCallback(
    async (relationshipId: number) => {
      const active = metadata.active_relationships.includes(relationshipId)
        ? metadata.active_relationships.filter(id => id !== relationshipId)
        : [...metadata.active_relationships, relationshipId];
      await updateMetadata({ active_relationships: active });
    },
    [metadata.active_relationships, updateMetadata],
  );

  return {
    metadata,
    updateMetadata,
    toggleRelationship,
  };
}
