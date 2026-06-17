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
import { useEffect, useRef } from 'react';
import type { ActiveJoin } from './useExploreRelationships';
import type { DatasetRelationship } from '../types';

/**
 * Syncs active relationships to the Explore form_data.
 *
 * Whenever active joins change, this hook dispatches a `setControlValue`
 * to store the active relationships in `form_data.active_relationships`.
 *
 * The query builder backend can then read this field to generate
 * JOIN clauses in the SQL query.
 *
 * @param activeJoins    Current active JOIN configurations
 * @param relationships  All relationships for this dataset
 * @param setControlValue Explore action to update a control value
 */
export function useSyncRelationshipsToFormData(
  activeJoins: Map<number, ActiveJoin>,
  relationships: DatasetRelationship[],
  setControlValue: (name: string, value: any) => void,
) {
  const lastJsonRef = useRef<string>('');

  useEffect(() => {
    const activeEntries = Array.from(activeJoins.values())
      .filter(j => j.enabled)
      .map(j => {
        const rel = relationships.find(r => r.id === j.relationshipId);
        if (!rel) return null;
        return {
          relationship_id: rel.id,
          join_type: rel.join_type,
          source_to_target: rel.columns.map(col => ({
            source_column: col.source_column_name,
            target_column: col.target_column_name,
            operator: col.operator,
          })),
          selected_columns: j.selectedColumns,
        };
      })
      .filter(Boolean);

    const payload = { active_relationships: activeEntries };
    const json = JSON.stringify(payload);
    if (json === lastJsonRef.current) return; // no change
    lastJsonRef.current = json;

    setControlValue('active_relationships', payload.active_relationships);
  }, [activeJoins, relationships, setControlValue]);
}
