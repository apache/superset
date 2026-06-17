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
import type { DatasetRelationship } from '../../types';

export interface RelationshipBadgeProps {
  relationship: DatasetRelationship;
  /** Whether the JOIN for this relationship is currently active */
  joinActive: boolean;
  /** Called when the badge is clicked to toggle the JOIN */
  onToggleJoin: (relationshipId: number) => void;
}

/**
 * A small badge/tag shown next to a column name in the Explore datasource panel.
 * Indicates that this column is connected to another dataset via a relationship.
 *
 * Clicking the badge toggles the JOIN on/off.
 * Active badge -> JOIN is enabled -> column is part of an active cross-dataset query.
 */
export function RelationshipBadge({
  relationship,
  joinActive,
  onToggleJoin,
}: RelationshipBadgeProps) {
  const targetLabel =
    relationship.name ?? `#${relationship.target_dataset_id}`;

  return (
    <span
      role="button"
      tabIndex={0}
      title={`${relationship.relationship_type} -> ${targetLabel} (${relationship.join_type} JOIN)`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 9,
        fontWeight: 600,
        padding: '1px 4px',
        borderRadius: 3,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.15s ease',
        backgroundColor: joinActive ? '#059669' : 'rgba(220, 38, 38, 0.08)',
        color: joinActive ? '#fff' : '#dc2626',
        border: joinActive ? '1px solid #059669' : '1px solid #dc2626',
        marginLeft: 4,
        verticalAlign: 'middle',
        lineHeight: 1,
      }}
      onClick={e => {
        e.stopPropagation();
        onToggleJoin(relationship.id);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onToggleJoin(relationship.id);
        }
      }}
    >
      <svg
        width="8"
        height="8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="5" r="3" />
        <circle cx="6" cy="19" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="12" y1="8" x2="12" y2="14" />
        <line x1="8" y1="17" x2="6" y2="16" />
        <line x1="16" y1="17" x2="18" y2="16" />
      </svg>
      {targetLabel}
    </span>
  );
}
