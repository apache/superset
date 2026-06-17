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
import { useMemo, useCallback, useState } from 'react';
import type { DatasetRelationship, RelationshipColumn } from '../types';

/**
 * Maps a column name to the relationships that reference it as source.
 */
export interface ColumnRelationshipInfo {
  columnName: string;
  relationships: DatasetRelationship[];
}

/**
 * Active join configuration — which relationship is active
 * and which target columns should be included in the query.
 */
export interface ActiveJoin {
  relationshipId: number;
  /** Columns selected from the target dataset to bring into the query */
  selectedColumns: string[];
  enabled: boolean;
}

export interface ExploreRelationshipsState {
  /** All relationships for this dataset */
  relationships: DatasetRelationship[];
  /** Map column_name → relationships where column is source */
  columnRelationshipMap: Map<string, DatasetRelationship[]>;
  /** Active JOIN configurations keyed by relationship ID */
  activeJoins: Map<number, ActiveJoin>;
  /** Resolved target column names available for each relationship */
  availableTargetColumns: Map<number, string[]>;
}

/**
 * Hook that manages dataset relationships within the Explore view.
 *
 * Takes the relationships array from the Datasource (injected by backend)
 * and provides utilities to:
 * - Look up which relationships involve a given column
 * - Toggle JOINs on/off
 * - Select which target columns to include
 * - Build the form_data fragment to send to the query backend
 */
export function useExploreRelationships(
  relationships: DatasetRelationship[],
) {
  const [activeJoins, setActiveJoins] = useState<Map<number, ActiveJoin>>(
    () => new Map(),
  );

  // Build column → relationships lookup
  const columnRelationshipMap = useMemo(() => {
    const map = new Map<string, DatasetRelationship[]>();
    relationships.forEach(rel => {
      rel.columns.forEach(col => {
        const existing = map.get(col.source_column_name) ?? [];
        existing.push(rel);
        map.set(col.source_column_name, existing);
      });
    });
    return map;
  }, [relationships]);

  // Build available target columns (column names from the target)
  const availableTargetColumns = useMemo(() => {
    const map = new Map<number, string[]>();
    // We don't have full target dataset schema here — this will
    // be populated lazily when the user activates a JOIN.
    relationships.forEach(rel => {
      if (!map.has(rel.target_dataset_id)) {
        map.set(rel.target_dataset_id, []);
      }
    });
    return map;
  }, [relationships]);

  // Lazy-load target columns when a relationship is activated
  const loadTargetColumns = useCallback(
    async (relationshipId: number) => {
      // If already loaded, skip
      if ((availableTargetColumns.get(relationshipId)?.length ?? 0) > 0) {
        return;
      }
      const rel = relationships.find(r => r.id === relationshipId);
      if (!rel) return;

      try {
        const { SupersetClient } = await import('@superset-ui/core');
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/dataset/${rel.target_dataset_id}`,
        });
        const cols: string[] =
          json?.result?.columns?.map(
            (c: { column_name: string }) => c.column_name,
          ) ?? [];
        setActiveJoins(prev => {
          const next = new Map(prev);
          const existing = next.get(relationshipId) ?? {
            relationshipId,
            selectedColumns: cols.slice(0, 5), // default: first 5
            enabled: false,
          };
          existing.selectedColumns = existing.selectedColumns.filter(c =>
            cols.includes(c),
          );
          next.set(relationshipId, existing);
          return next;
        });
        // Store available columns
        setAvailableTargetColumns(prev => {
          const next = new Map(prev);
          next.set(relationshipId, cols);
          return next;
        });
      } catch {
        // Silently fail — user can still manually type column names
      }
    },
    [relationships, availableTargetColumns],
  );

  // Store available target columns (separate from derived state)
  const [availableColumnsState, setAvailableTargetColumns] = useState<
    Map<number, string[]>
  >(availableTargetColumns);

  // Toggle a relationship JOIN on/off
  const toggleJoin = useCallback(
    async (relationshipId: number) => {
      const rel = relationships.find(r => r.id === relationshipId);
      if (!rel) return;

      setActiveJoins(prev => {
        const next = new Map(prev);
        const current = next.get(relationshipId);

        if (current) {
          next.set(relationshipId, { ...current, enabled: !current.enabled });
        } else {
          // Default: first 5 target columns auto-selected
          const defaultSelected = rel.columns.map(c => c.target_column_name);
          next.set(relationshipId, {
            relationshipId,
            selectedColumns: defaultSelected,
            enabled: true,
          });
          // Eagerly load target columns
          loadTargetColumns(relationshipId);
        }

        return next;
      });
    },
    [relationships, loadTargetColumns],
  );

  // Enable a specific relationship with all target columns
  const enableJoin = useCallback(
    async (relationshipId: number, targetColumns?: string[]) => {
      const rel = relationships.find(r => r.id === relationshipId);
      if (!rel) return;

      setActiveJoins(prev => {
        const next = new Map(prev);
        next.set(relationshipId, {
          relationshipId,
          selectedColumns: targetColumns ?? rel.columns.map(c => c.target_column_name),
          enabled: true,
        });
        return next;
      });

      if (!targetColumns) {
        loadTargetColumns(relationshipId);
      }
    },
    [relationships, loadTargetColumns],
  );

  // Disable a specific relationship
  const disableJoin = useCallback((relationshipId: number) => {
    setActiveJoins(prev => {
      const next = new Map(prev);
      const current = next.get(relationshipId);
      if (current) {
        next.set(relationshipId, { ...current, enabled: false });
      }
      return next;
    });
  }, []);

  // Update selected columns for a relationship
  const updateSelectedColumns = useCallback(
    (relationshipId: number, columns: string[]) => {
      setActiveJoins(prev => {
        const next = new Map(prev);
        const current = next.get(relationshipId);
        if (current) {
          next.set(relationshipId, { ...current, selectedColumns: columns });
        }
        return next;
      });
    },
    [],
  );

  // Get the ColumnRelationshipInfo for a specific column
  const getColumnInfo = useCallback(
    (columnName: string): ColumnRelationshipInfo => ({
      columnName,
      relationships: columnRelationshipMap.get(columnName) ?? [],
    }),
    [columnRelationshipMap],
  );

  // Find if a column is the source column of any ACTIVE relationship
  const isColumnInActiveJoin = useCallback(
    (columnName: string): boolean => {
      const rels = columnRelationshipMap.get(columnName) ?? [];
      return rels.some(rel => {
        const join = activeJoins.get(rel.id);
        return join?.enabled === true;
      });
    },
    [columnRelationshipMap, activeJoins],
  );

  // Build the form_data fragment with active relationships
  const buildRelationshipFormData = useCallback((): {
    active_relationships?: Array<{
      relationship_id: number;
      join_type: string;
      columns: RelationshipColumn[];
      selected_columns: string[];
    }>;
  } => {
    const activeEntries: Array<{
      relationship_id: number;
      join_type: string;
      columns: RelationshipColumn[];
      selected_columns: string[];
    }> = [];

    activeJoins.forEach(join => {
      if (!join.enabled) return;
      const rel = relationships.find(r => r.id === join.relationshipId);
      if (!rel) return;

      activeEntries.push({
        relationship_id: rel.id,
        join_type: rel.join_type,
        columns: rel.columns,
        selected_columns: join.selectedColumns,
      });
    });

    return activeEntries.length > 0
      ? { active_relationships: activeEntries }
      : {};
  },
  [activeJoins, relationships],
  );

  // Check if any leads to a column with the given name in a relationship
  const findRelationshipByTargetColumn = useCallback(
    (columnName: string): DatasetRelationship | undefined =>
      relationships.find(rel =>
        rel.columns.some(col => col.target_column_name === columnName),
      ),
    [relationships],
  );

  return {
    // State
    activeJoins,
    columnRelationshipMap,
    availableTargetColumns: availableColumnsState,

    // Queries
    getColumnInfo,
    isColumnInActiveJoin,
    findRelationshipByTargetColumn,

    // Actions
    toggleJoin,
    enableJoin,
    disableJoin,
    updateSelectedColumns,
    loadTargetColumns,

    // Build form_data
    buildRelationshipFormData,
  };
}
