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

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type {
  DatasetNode as DatasetNodeType,
  DatasetSummary,
} from '../../types';
import { hashStringToColor, hashStringToBg } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function databaseColor(ds: DatasetSummary): string {
  const name = ds.database?.database_name ?? 'default';
  return hashStringToColor(name);
}

function databaseBg(ds: DatasetSummary): string {
  const name = ds.database?.database_name ?? 'default';
  return hashStringToBg(name);
}

function isPK(columnName: string, type: string | null | undefined): boolean {
  return columnName.toLowerCase() === 'id' || (type ?? '').toUpperCase().includes('SERIAL');
}

// ---------------------------------------------------------------------------
// SVG icons (inline)
// ---------------------------------------------------------------------------

const TableIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const ColumnIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, opacity: 0.5 }}
  >
    <rect x="3" y="3" width="7" height="18" rx="1" />
    <rect x="14" y="3" width="7" height="18" rx="1" />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DatasetNodeComponent({ data, selected }: NodeProps<DatasetNodeType>) {
  const { dataset, label } = data;
  const columns = dataset.columns ?? [];
  const dbName = dataset.database?.database_name ?? 'DB';
  const dbColor = databaseColor(dataset);
  const dbBg = databaseBg(dataset);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  return (
    <div
      style={{
        background: '#fff',
        border: `2px solid ${selected ? dbColor : '#e0e0e0'}`,
        borderRadius: 8,
        minWidth: 220,
        maxWidth: 340,
        fontSize: '13px',
        fontFamily: 'inherit',
        boxShadow: selected
          ? `0 0 0 1px ${dbColor}, 0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)`
          : '0 3px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Header with gradient */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: `1px solid ${selected ? dbColor : '#e8e8e8'}`,
          background: selected
            ? `linear-gradient(135deg, ${dbBg}, #fff)`
            : `linear-gradient(135deg, #fafafa, #fff)`,
          cursor: 'grab',
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}
        >
          <TableIcon />
          <span
            style={{
              fontWeight: 'bold',
              fontSize: '14px',
              color: '#333',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={label || dataset.table_name}
          >
            {label || dataset.table_name}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              background: '#f0f0f0',
              color: '#666',
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: 8,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
            title={`${columns.length} columns`}
          >
            {columns.length}
          </span>
        </div>

        <div
          style={{
            fontSize: '11px',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              background: dbBg,
              color: dbColor,
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {dbName}
          </span>
          {dataset.schema && (
            <>
              <span style={{ color: '#ccc' }}>/</span>
              <span style={{ color: '#999' }}>{dataset.schema}</span>
            </>
          )}
        </div>
      </div>

      {/* Column list */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {columns.length === 0 && (
          <div style={{ padding: '8px 12px', color: '#999', fontSize: '12px' }}>
            No columns loaded
          </div>
        )}
        {columns.map((col: { column_name: string; type: string | null }) => {
          const handleBase = `${dataset.id}-${col.column_name}`;
          const isPKCol = isPK(col.column_name, col.type);
          const isColHovered = hoveredCol === col.column_name;

          return (
            <div
              key={col.column_name}
              onMouseEnter={() => setHoveredCol(col.column_name)}
              onMouseLeave={() => setHoveredCol(null)}
              style={{
                position: 'relative',
                padding: '5px 22px',
                fontSize: '12px',
                lineHeight: '20px',
                color: '#444',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderBottom: '1px solid #f5f5f5',
                background: isColHovered ? '#f7fbff' : '#fff',
                transition: 'background 0.15s ease',
              }}
            >
              {/* Target handle (left) */}
              <Handle
                type="target"
                position={Position.Left}
                id={`target-${handleBase}`}
                style={{
                  width: 8,
                  height: 8,
                  background: isColHovered ? '#1a6d85' : '#2893B3',
                  border: '2px solid #fff',
                  borderRadius: '50%',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  transform: isColHovered ? 'scale(1.3)' : 'scale(1)',
                }}
                title={`Target: ${col.column_name}`}
              />

              <ColumnIcon />

              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isPKCol ? '#c41a1a' : '#444',
                  fontWeight: isPKCol ? 600 : 400,
                }}
                title={col.column_name}
              >
                {col.column_name}
              </span>

              {isPKCol && (
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#c41a1a',
                    background: '#fff0f0',
                    padding: '0 4px',
                    borderRadius: 3,
                    flexShrink: 0,
                  }}
                >
                  PK
                </span>
              )}

              {col.type && (
                <span
                  style={{
                    fontSize: '9px',
                    color: '#999',
                    background: '#f0f0f0',
                    padding: '1px 4px',
                    borderRadius: 3,
                    flexShrink: 0,
                    maxWidth: 60,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={col.type}
                >
                  {col.type}
                </span>
              )}

              {/* Source handle (right) */}
              <Handle
                type="source"
                position={Position.Right}
                id={`source-${handleBase}`}
                style={{
                  width: 8,
                  height: 8,
                  background: isColHovered ? '#1a6d85' : '#2893B3',
                  border: '2px solid #fff',
                  borderRadius: '50%',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  transform: isColHovered ? 'scale(1.3)' : 'scale(1)',
                }}
                title={`Source: ${col.column_name}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const DatasetNode = memo(DatasetNodeComponent);
