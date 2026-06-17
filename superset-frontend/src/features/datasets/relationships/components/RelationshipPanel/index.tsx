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
import { useState } from 'react';
import type {
  DatasetRelationship,
  ActiveJoin,
} from '../../hooks/useExploreRelationships';
import type { RelationshipColumn } from '../../types';

interface RelationshipPanelProps {
  relationships: DatasetRelationship[];
  activeJoins: Map<number, ActiveJoin>;
  availableTargetColumns: Map<number, string[]>;
  onToggleJoin: (relationshipId: number) => void;
  onUpdateSelectedColumns: (relationshipId: number, columns: string[]) => void;
}

/**
 * Panel section in the Explore datasource sidebar showing
 * available relationships and their JOIN status.
 *
 * Users can:
 * - Toggle JOIN on/off
 * - See which columns map to which target
 * - Select which target columns to include
 */
export function RelationshipPanel({
  relationships,
  activeJoins,
  availableTargetColumns,
  onToggleJoin,
  onUpdateSelectedColumns,
}: RelationshipPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (relationships.length === 0) return null;

  return (
    <div style={{
      padding: '16px',
      borderBottom: '1px solid #e8e8e8',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <h4 style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: 600,
        }}>
          Relationships
        </h4>
        {relationships.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '12px',
              color: '#2893B3',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {expanded ? 'Collapse' : 'Show all'}
          </button>
        )}
      </div>

      {(expanded ? relationships : relationships.slice(0, 1)).map(rel => {
        const join = activeJoins.get(rel.id);
        const enabled = join?.enabled ?? false;
        const selectedCols = join?.selectedColumns ?? [];
        const targetCols = availableTargetColumns.get(rel.id) ?? [];

        return (
          <div
            key={rel.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              marginBottom: '4px',
              borderRadius: '6px',
              background: enabled
                ? 'rgba(5, 150, 105, 0.06)'
                : '#fafafa',
              border: '1px solid',
              borderColor: enabled ? 'rgba(5, 150, 105, 0.2)' : '#e8e8e8',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = enabled
                ? 'rgba(5, 150, 105, 0.1)'
                : '#f0f0f0';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = enabled
                ? 'rgba(5, 150, 105, 0.06)'
                : '#fafafa';
            }}
          >
            <button
              type="button"
              onClick={() => onToggleJoin(rel.id)}
              style={{
                width: 28,
                height: 16,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                transition: 'all 0.15s ease',
                flexShrink: 0,
                backgroundColor: enabled ? '#059669' : '#e0e0e0',
                position: 'relative',
              }}
            >
              <span style={{
                display: 'block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'white',
                transition: 'transform 0.15s ease',
                transform: enabled ? 'translateX(12px)' : 'translateX(0)',
              }} />
            </button>

            <div style={{
              flex: 1,
              minWidth: 0,
              fontSize: '12px',
            }}>
              <div style={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {rel.name ?? `Relationship #${rel.id}`}
              </div>
              <div style={{
                color: '#666',
                fontSize: '11px',
                marginTop: 1,
              }}>
                {rel.relationship_type.replace(/_/g, ' \u2192 ')} &middot;{' '}
                {rel.join_type} JOIN &middot;{' '}
                {rel.columns
                  ?.map(
                    (col: RelationshipColumn) =>
                      `${col.source_column_name} \u2192 ${col.target_column_name}`,
                  )
                  .join(', ') ?? ''}
              </div>
              {enabled && targetCols.length > 0 && (
                <div style={{
                  marginTop: '4px',
                }}>
                  {targetCols.map(colName => (
                    <label
                      key={colName}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        padding: '1px 4px',
                        margin: '1px 4px 1px 0',
                        borderRadius: 2,
                        background: '#f0f0f0',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCols.includes(colName)}
                        onChange={e => {
                          if (e.target.checked) {
                            onUpdateSelectedColumns(rel.id, [
                              ...selectedCols,
                              colName,
                            ]);
                          } else {
                            onUpdateSelectedColumns(
                              rel.id,
                              selectedCols.filter((c: string) => c !== colName),
                            );
                          }
                        }}
                        style={{ margin: 0, cursor: 'pointer' }}
                      />
                      {colName}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
