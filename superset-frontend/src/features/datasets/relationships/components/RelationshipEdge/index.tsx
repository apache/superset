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

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  MarkerType,
} from '@xyflow/react';
import type { RelationshipEdge as RelationshipEdgeType } from '../../types';
import { JOIN_TYPE_COLORS } from '../../types';

/**
 * Relationship type → human-readable label.
 */
const CARDINALITY_LABEL: Record<string, string> = {
  one_to_one: '1:1',
  one_to_many: '1:N',
  many_to_one: 'N:1',
  many_to_many: 'N:N',
};

/**
 * Custom React Flow edge representing a dataset relationship.
 * Displays cardinality, join type, and cross-DB indicator with
 * color-coded join types and compact labeling.
 */
function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationshipEdgeType>) {
  const rel = data?.relationship;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  const isCrossDb = rel?.is_cross_database ?? false;
  const joinType = rel?.join_type ?? 'LEFT';
  const edgeColor = JOIN_TYPE_COLORS[joinType] ?? '#bbb';

  const color = selected ? '#2893B3' : edgeColor;

  const cardinality = rel
    ? CARDINALITY_LABEL[rel.relationship_type] ?? '?'
    : '';
  const joinLabel = joinType;

  // Build column pair tooltip
  const columnLabels = rel?.columns
    ?.map(c => `${c.source_column_name} ${c.operator} ${c.target_column_name}`)
    ?.join(', ') ?? '';

  const compactColumns = rel?.columns
    ?.map(c => `${c.source_column_name} → ${c.target_column_name}`)
    ?.join(', ') ?? '';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          transition: 'stroke 0.2s ease',
        }}
        markerEnd={{
          type: MarkerType.ArrowClosed,
          color,
          width: selected ? 14 : 12,
          height: selected ? 14 : 12,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            fontSize: '11px',
            fontFamily: 'inherit',
            background: selected ? '#fff' : '#fafafa',
            border: `1px solid ${color}`,
            borderRadius: 5,
            padding: '3px 8px',
            color: '#333',
            whiteSpace: 'nowrap',
            boxShadow: selected
              ? '0 2px 8px rgba(0,0,0,0.1)'
              : '0 1px 4px rgba(0,0,0,0.05)',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          }}
          className="nodrag nopan"
          title={columnLabels || undefined}
        >
          <span style={{ fontWeight: 600 }}>
            {cardinality}
          </span>
          {joinLabel && (
            <span
              style={{
                marginLeft: 4,
                color: '#888',
                fontSize: '10px',
              }}
            >
              · {joinLabel}
            </span>
          )}
          {isCrossDb && (
            <span
              style={{
                marginLeft: 4,
                color: '#d4a017',
                fontSize: '11px',
              }}
              title="Cross-database relationship"
            >
              ⚡
            </span>
          )}
          {!isCrossDb && compactColumns && (
            <div
              style={{
                fontSize: '9px',
                color: '#2893B3',
                marginTop: 1,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {compactColumns}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
