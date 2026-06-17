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

import { useState, useCallback, useMemo } from 'react';
import { Button, Input, Select } from '@superset-ui/core/components';
import type {
  DatasetRelationship,
  RelationshipType,
  JoinType,
  RelationshipColumn,
  SidebarTab,
} from '../../types';
import type { DatasetSummary } from '../../types';
import { JOIN_TYPE_COLORS } from '../../types';
import ColumnPickerModal from '../ColumnPickerModal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RELATIONSHIP_TYPE_OPTIONS = [
  { value: 'one_to_one', label: '1:1' },
  { value: 'one_to_many', label: '1:N' },
  { value: 'many_to_one', label: 'N:1' },
  { value: 'many_to_many', label: 'N:N' },
];

const JOIN_TYPE_OPTIONS = [
  { value: 'LEFT', label: 'LEFT' },
  { value: 'INNER', label: 'INNER' },
  { value: 'RIGHT', label: 'RIGHT' },
  { value: 'FULL', label: 'FULL' },
];

const CARDINALITY_LABEL: Record<string, string> = {
  one_to_one: '1:1',
  one_to_many: '1:N',
  many_to_one: 'N:1',
  many_to_many: 'N:N',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RelationshipSidebarProps {
  relationship: DatasetRelationship | null;
  sourceDataset: DatasetSummary | null;
  targetDataset: DatasetSummary | null;
  allRelationships: DatasetRelationship[];
  allDatasets: DatasetSummary[];
  onUpdate: (id: number, data: Partial<DatasetRelationship>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
  onSelectRelationship: (rel: DatasetRelationship) => void;
  pendingConnection: { sourceId: number; targetId: number } | null;
  onCreateFromPending: (columns: RelationshipColumn[]) => Promise<void>;
  onCancelPending: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Tab bar
interface TabBarProps {
  activeTab: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  relationshipCount: number;
}

function TabBar({ activeTab, onChange, relationshipCount }: TabBarProps) {
  const tabs: { key: SidebarTab; label: string }[] = [
    { key: 'grid', label: `Grid (${relationshipCount})` },
    { key: 'detail', label: 'Detail' },
    { key: 'new', label: '+' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa',
      }}
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              flex: tab.key === 'new' ? 0 : 1,
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#2893B3' : '#666',
              background: isActive ? '#fff' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #2893B3' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Grid tab
interface GridTabProps {
  relationships: DatasetRelationship[];
  allDatasets: DatasetSummary[];
  onSelect: (rel: DatasetRelationship) => void;
  onToggleActive: (id: number, isActive: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function GridTab({
  relationships,
  allDatasets,
  onSelect,
  onToggleActive,
  onDelete,
}: GridTabProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created'>('name');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = [...relationships];
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        rel =>
          (rel.name ?? '').toLowerCase().includes(s) ||
          `rel #${rel.id}`.includes(s),
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'name') {
        const na = a.name ?? `rel-${a.id}`;
        const nb = b.name ?? `rel-${b.id}`;
        return na.localeCompare(nb);
      }
      const da = a.created_on ?? '';
      const db = b.created_on ?? '';
      return da.localeCompare(db);
    });
    return list;
  }, [relationships, search, sortBy]);

  const datasetName = useCallback(
    (id: number): string => {
      const ds = allDatasets.find(d => d.id === id);
      return ds?.table_name ?? `Dataset #${id}`;
    },
    [allDatasets],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setConfirmDeleteId(null);
      await onDelete(id);
    },
    [onDelete],
  );

  if (relationships.length === 0) {
    return (
      <div style={{ padding: 16, color: '#666', fontSize: '13px' }}>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>No relationships yet.</strong>
        </p>
        <p style={{ margin: 0, color: '#999' }}>
          Drag a connection between two dataset columns on the canvas, or use the{' '}
          <strong>+ tab</strong> to create one.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Search + sort */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          placeholder="Search relationships…"
          style={{ fontSize: '12px', marginBottom: 6 }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#999' }}>Sort:</span>
          <button
            type="button"
            onClick={() => setSortBy('name')}
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              background: sortBy === 'name' ? '#2893B3' : '#e8e8e8',
              color: sortBy === 'name' ? '#fff' : '#666',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Name
          </button>
          <button
            type="button"
            onClick={() => setSortBy('created')}
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              background: sortBy === 'created' ? '#2893B3' : '#e8e8e8',
              color: sortBy === 'created' ? '#fff' : '#666',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Created
          </button>
        </div>
      </div>

      {/* Relationship list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {filtered.map(rel => {
          const relName = rel.name ?? `Rel #${rel.id}`;
          return (
            <div
              key={rel.id}
              onClick={() => onSelect(rel)}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                transition: 'background 0.1s ease',
                fontSize: '12px',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = '#f5f9fc';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = '#fff';
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
                {/* Active/inactive badge */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: rel.is_active ? '#52c41a' : '#ccc',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                  title={rel.is_active ? 'Active' : 'Inactive'}
                />
                <span
                  style={{
                    fontWeight: 600,
                    color: '#333',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {relName}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#666',
                  fontSize: '11px',
                }}
              >
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {datasetName(rel.source_dataset_id)}
                </span>
                <span style={{ color: '#ccc' }}>→</span>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {datasetName(rel.target_dataset_id)}
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Cardinality tag */}
                  <span
                    style={{
                      fontSize: '10px',
                      background: '#f0f0f0',
                      color: '#666',
                      padding: '1px 4px',
                      borderRadius: 3,
                      fontWeight: 600,
                    }}
                  >
                    {CARDINALITY_LABEL[rel.relationship_type] ?? '?'}
                  </span>

                  {/* Join type tag */}
                  <span
                    style={{
                      fontSize: '9px',
                      background: `${JOIN_TYPE_COLORS[rel.join_type] ?? '#999'}20`,
                      color: JOIN_TYPE_COLORS[rel.join_type] ?? '#999',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}
                  >
                    {rel.join_type}
                  </span>

                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onToggleActive(rel.id, !rel.is_active);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      fontSize: '13px',
                      color: rel.is_active ? '#52c41a' : '#ccc',
                      lineHeight: 1,
                    }}
                    title={rel.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {rel.is_active ? '👁' : '👁‍🗨'}
                  </button>

                  {/* Delete button */}
                  {confirmDeleteId === rel.id ? (
                    <span style={{ fontSize: '10px', display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(rel.id);
                        }}
                        style={{
                          background: '#ff4d4f',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 3,
                          padding: '1px 4px',
                          fontSize: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        style={{
                          background: '#e8e8e8',
                          border: 'none',
                          borderRadius: 3,
                          padding: '1px 4px',
                          fontSize: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setConfirmDeleteId(rel.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 2,
                        fontSize: '12px',
                        color: '#ccc',
                        lineHeight: 1,
                      }}
                      title="Delete"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Detail tab
interface DetailTabProps {
  relationship: DatasetRelationship;
  sourceDataset: DatasetSummary | null;
  targetDataset: DatasetSummary | null;
  onUpdate: (id: number, data: Partial<DatasetRelationship>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onBack: () => void;
}

function DetailTab({
  relationship,
  sourceDataset,
  targetDataset,
  onUpdate,
  onDelete,
  onBack,
}: DetailTabProps) {
  const [saving, setSaving] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const [relType, setRelType] = useState<RelationshipType>(
    relationship?.relationship_type ?? 'many_to_one',
  );
  const [joinType, setJoinType] = useState<JoinType>(
    relationship?.join_type ?? 'LEFT',
  );
  const [name, setName] = useState(relationship?.name ?? '');
  const [description, setDescription] = useState(
    relationship?.description ?? '',
  );
  const [isActive, setIsActive] = useState(relationship?.is_active ?? true);
  const [columns, setColumns] = useState<RelationshipColumn[]>(
    relationship?.columns ?? [],
  );

  const handleSave = useCallback(async () => {
    if (!relationship) return;
    setSaving(true);
    try {
      await onUpdate(relationship.id, {
        relationship_type: relType,
        join_type: joinType,
        name: name || null,
        description: description || null,
        is_active: isActive,
        columns: columns.map((col, i) => ({
          source_column_name: col.source_column_name,
          target_column_name: col.target_column_name,
          operator: col.operator,
          ordinal: i,
        })),
      });
    } finally {
      setSaving(false);
    }
  }, [relationship, relType, joinType, name, description, isActive, columns, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!relationship) return;
    // eslint-disable-next-line no-alert
    if (window.confirm('Delete this relationship permanently?')) {
      await onDelete(relationship.id);
    }
  }, [relationship, onDelete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        height: '100%',
        overflowY: 'auto',
        fontSize: '13px',
      }}
    >
      {/* Back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#2893B3',
            padding: 0,
          }}
        >
          ← Back to Grid
        </button>
      </div>

      {/* Info card */}
      <div
        style={{
          background: '#fafafa',
          borderRadius: 6,
          padding: 12,
          border: '1px solid #e8e8e8',
        }}
      >
        <h4
          style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: '#333',
            fontWeight: 600,
          }}
        >
          {relationship.name ?? `Relationship #${relationship.id}`}
        </h4>

        <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
          <strong>Source:</strong>{' '}
          {sourceDataset?.table_name ?? `Dataset #${relationship.source_dataset_id}`}
          {relationship.is_cross_database && (
            <span style={{ color: '#d4a017', marginLeft: 6 }}>⚡ Cross-DB</span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <strong>Target:</strong>{' '}
          {targetDataset?.table_name ?? `Dataset #${relationship.target_dataset_id}`}
        </div>
      </div>

      {/* Fields card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 6,
          padding: 12,
          border: '1px solid #e8e8e8',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#555' }}>
          Information
        </div>

        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 3,
              fontSize: '11px',
              color: '#666',
              fontWeight: 600,
            }}
          >
            Name
          </label>
          <Input
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="Optional name…"
            style={{ fontSize: '12px' }}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 3,
              fontSize: '11px',
              color: '#666',
              fontWeight: 600,
            }}
          >
            Description
          </label>
          <Input
            value={description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDescription(e.target.value)
            }
            placeholder="Optional description…"
            style={{ fontSize: '12px' }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 3,
                fontSize: '11px',
                color: '#666',
                fontWeight: 600,
              }}
            >
              Cardinality
            </label>
            <Select
              value={relType}
              options={RELATIONSHIP_TYPE_OPTIONS}
              onChange={(v: string) => setRelType(v as RelationshipType)}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 3,
                fontSize: '11px',
                color: '#666',
                fontWeight: 600,
              }}
            >
              Join Type
            </label>
            <Select
              value={joinType}
              options={JOIN_TYPE_OPTIONS}
              onChange={(v: string) => setJoinType(v as JoinType)}
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600, color: '#555' }}>Active</span>
          </label>
        </div>
      </div>

      {/* Column mappings card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 6,
          padding: 12,
          border: '1px solid #e8e8e8',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#555' }}>
            Column Mappings ({columns.length})
          </span>
          <Button
            buttonSize="xsmall"
            buttonStyle="primary"
            onClick={() => setShowColumnPicker(true)}
          >
            Edit
          </Button>
        </div>
        {columns.length > 0 ? (
          <div
            style={{
              background: '#fafafa',
              borderRadius: 4,
              padding: 8,
            }}
          >
            {columns.map((col, i) => (
              <div
                key={col.source_column_name + col.target_column_name + i}
                style={{ fontSize: '11px', marginBottom: 3 }}
              >
                <span style={{ fontWeight: 600, color: '#333' }}>
                  {col.source_column_name}
                </span>{' '}
                <span style={{ color: '#2893B3' }}>{col.operator}</span>{' '}
                <span style={{ fontWeight: 600, color: '#333' }}>
                  {col.target_column_name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#999', fontSize: '12px' }}>
            No column mappings configured.
          </div>
        )}
      </div>

      {/* Actions card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 6,
          padding: 12,
          border: '1px solid #e8e8e8',
          display: 'flex',
          gap: 8,
          marginTop: 'auto',
        }}
      >
        <Button
          buttonSize="small"
          buttonStyle="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={handleDelete}
          disabled={saving}
        >
          Delete
        </Button>
      </div>

      {/* Column Picker Modal */}
      <ColumnPickerModal
        show={showColumnPicker}
        sourceDataset={sourceDataset}
        targetDataset={targetDataset}
        initialColumns={columns}
        onSave={setColumns}
        onHide={() => setShowColumnPicker(false)}
      />
    </div>
  );
}

// New tab
interface NewTabProps {
  allDatasets: DatasetSummary[];
  pendingNewRel: {
    sourceId: number;
    targetId: number;
  } | null;
  onCreate: (columns: RelationshipColumn[]) => Promise<void>;
  onCancel: () => void;
}

function NewTab({
  allDatasets,
  pendingNewRel,
  onCreate,
  onCancel,
}: NewTabProps) {
  const [sourceId, setSourceId] = useState<number | undefined>(
    pendingNewRel?.sourceId,
  );
  const [targetId, setTargetId] = useState<number | undefined>(
    pendingNewRel?.targetId,
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [columns, setColumns] = useState<RelationshipColumn[]>([]);

  const datasetOptions = useMemo(
    () =>
      allDatasets.map(ds => ({
        value: ds.id,
        label: `${ds.table_name} (${ds.database?.database_name ?? '?'})`,
      })),
    [allDatasets],
  );

  const handleCreate = useCallback(() => {
    if (!sourceId || !targetId || columns.length === 0) return;
    onCreate(columns);
  }, [sourceId, targetId, columns, onCreate]);

  const canCreate = sourceId && targetId && columns.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        fontSize: '13px',
      }}
    >
      {pendingNewRel && (
        <div
          style={{
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: '12px',
            color: '#0050b3',
          }}
        >
          Creating relationship from column connection
        </div>
      )}

      <div>
        <label
          style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
          }}
        >
          Source Dataset
        </label>
        <Select
          value={sourceId}
          options={datasetOptions}
          onChange={(v: number) => setSourceId(v)}
          placeholder="Select source dataset…"
        />
      </div>

      <div>
        <label
          style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
          }}
        >
          Target Dataset
        </label>
        <Select
          value={targetId}
          options={datasetOptions}
          onChange={(v: number) => setTargetId(v)}
          placeholder="Select target dataset…"
        />
      </div>

      <div>
        <label
          style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
          }}
        >
          Column Mappings ({columns.length})
        </label>
        <Button
          buttonSize="small"
          buttonStyle="tertiary"
          onClick={() => setShowColumnPicker(true)}
        >
          Configure Columns
        </Button>
        {columns.length > 0 && (
          <div
            style={{
              marginTop: 8,
              background: '#fafafa',
              borderRadius: 4,
              padding: 8,
            }}
          >
            {columns.map((col, i) => (
              <div
                key={col.source_column_name + col.target_column_name + i}
                style={{ fontSize: '11px', marginBottom: 3 }}
              >
                <span style={{ fontWeight: 600 }}>{col.source_column_name}</span>{' '}
                {col.operator}{' '}
                <span style={{ fontWeight: 600 }}>{col.target_column_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button
          buttonSize="small"
          buttonStyle="primary"
          onClick={handleCreate}
          disabled={!canCreate}
        >
          Create Relationship
        </Button>
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>

      <ColumnPickerModal
        show={showColumnPicker}
        sourceDataset={
          sourceId ? allDatasets.find(d => d.id === sourceId) ?? null : null
        }
        targetDataset={
          targetId ? allDatasets.find(d => d.id === targetId) ?? null : null
        }
        initialColumns={columns}
        onSave={cols => {
          setColumns(cols);
          setShowColumnPicker(false);
        }}
        onHide={() => setShowColumnPicker(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------

export default function RelationshipSidebar({
  relationship,
  sourceDataset,
  targetDataset,
  allRelationships,
  allDatasets,
  onUpdate,
  onDelete,
  onClose,
  onSelectRelationship,
  pendingConnection,
  onCreateFromPending,
  onCancelPending,
}: RelationshipSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    relationship ? 'detail' : 'grid',
  );

  const handleToggleActive = useCallback(
    async (id: number, newActive: boolean) => {
      await onUpdate(id, { is_active: newActive });
    },
    [onUpdate],
  );

  const handleSelectRelationship = useCallback(
    (rel: DatasetRelationship) => {
      onSelectRelationship(rel);
      setActiveTab('detail');
    },
    [onSelectRelationship],
  );

  const handleNewFromPending = useCallback(
    async (columns: RelationshipColumn[]) => {
      await onCreateFromPending(columns);
      setActiveTab('grid');
    },
    [onCreateFromPending],
  );

  // If a pending connection exists, switch to the new tab
  if (pendingConnection && activeTab !== 'new') {
    setActiveTab('new');
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: 'inherit',
        fontSize: '13px',
        background: '#fff',
      }}
    >
      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        relationshipCount={allRelationships.length}
      />

      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {activeTab === 'grid' && (
          <GridTab
            relationships={allRelationships}
            allDatasets={allDatasets}
            onSelect={handleSelectRelationship}
            onToggleActive={handleToggleActive}
            onDelete={onDelete}
          />
        )}

        {activeTab === 'detail' && relationship ? (
          <DetailTab
            relationship={relationship}
            sourceDataset={sourceDataset}
            targetDataset={targetDataset}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onBack={() => {
              onClose();
              setActiveTab('grid');
            }}
          />
        ) : activeTab === 'detail' && !relationship ? (
          <div style={{ padding: 16, color: '#999', fontSize: '13px' }}>
            Select a relationship from the grid to view details.
          </div>
        ) : null}

        {activeTab === 'new' && (
          <NewTab
            allDatasets={allDatasets}
            pendingNewRel={pendingConnection}
            onCreate={
              pendingConnection ? handleNewFromPending : async (columns) => {
                // Regular create handled by canvas
                await onCreateFromPending(columns);
                setActiveTab('grid');
              }
            }
            onCancel={() => {
              onCancelPending();
              setActiveTab('grid');
            }}
          />
        )}
      </div>
    </div>
  );
}
