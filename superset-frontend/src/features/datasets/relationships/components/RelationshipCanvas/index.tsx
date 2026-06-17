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

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@superset-ui/core/components';
import { DatasetNode } from '../DatasetNode';
import { RelationshipEdge } from '../RelationshipEdge';
import RelationshipSidebar from '../RelationshipSidebar';
import ColumnPickerModal from '../ColumnPickerModal';
import {
  useRelationships,
  useCreateRelationship,
  useUpdateRelationship,
  useDeleteRelationship,
  useDatasetList,
  useDatasetColumnsEnricher,
} from '../../hooks';
import type {
  DatasetRelationship,
  DatasetNode as DatasetNodeType,
  RelationshipEdge as RelationshipEdgeType,
  DatasetSummary,
  RelationshipColumn,
} from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = { dataset: DatasetNode } as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes = { relationship: RelationshipEdge } as any;

/**
 * Auto-layout algorithm: group datasets by database → schema,
 * lay out in a grid with source datasets left, targets right.
 */
function computeAutoLayout(
  datasets: DatasetSummary[],
  relationships: DatasetRelationship[],
  manuallyAddedIds: Set<number>,
): DatasetNodeType[] {
  const relatedIds = new Set<number>();
  relationships.forEach(rel => {
    relatedIds.add(rel.source_dataset_id);
    relatedIds.add(rel.target_dataset_id);
  });
  manuallyAddedIds.forEach(id => relatedIds.add(id));

  const visible = datasets.filter(ds => relatedIds.has(ds.id));
  if (visible.length === 0) return [];

  // Build group key: database::schema
  const groupKey = (ds: DatasetSummary) =>
    `${ds.database?.database_name ?? 'unknown'}::${ds.schema ?? 'public'}`;

  const groups = new Map<string, DatasetSummary[]>();
  visible.forEach(ds => {
    const key = groupKey(ds);
    const arr = groups.get(key) ?? [];
    arr.push(ds);
    groups.set(key, arr);
  });

  const nodes: DatasetNodeType[] = [];
  let groupX = 0;
  const COLS_PER_GROUP = 4;
  const X_SPACING = 350;
  const Y_SPACING = 340;
  const GROUP_GAP = 80;

  groups.forEach((groupDatasets, key) => {
    // Sort datasets: those that are sources first, then targets, then rest
    const sorted = [...groupDatasets].sort((a, b) => {
      const aIsSource = relationships.some(r => r.source_dataset_id === a.id);
      const bIsSource = relationships.some(r => r.source_dataset_id === b.id);
      if (aIsSource && !bIsSource) return -1;
      if (!aIsSource && bIsSource) return 1;
      return a.table_name.localeCompare(b.table_name);
    });

    sorted.forEach((ds, i) => {
      nodes.push({
        id: `dataset-${ds.id}`,
        type: 'dataset',
        position: {
          x: groupX + (i % COLS_PER_GROUP) * X_SPACING + 50,
          y: Math.floor(i / COLS_PER_GROUP) * Y_SPACING + 50,
        },
        data: {
          dataset: ds,
          label: ds.table_name,
        },
      });
    });

    // Compute next group X position
    const groupWidth = Math.min(sorted.length, COLS_PER_GROUP) * X_SPACING;
    groupX += groupWidth + GROUP_GAP;
  });

  return nodes;
}

function relationshipsToEdges(
  relationships: DatasetRelationship[],
): RelationshipEdgeType[] {
  return relationships.map(rel => ({
    id: `relationship-${rel.id}`,
    source: `dataset-${rel.source_dataset_id}`,
    target: `dataset-${rel.target_dataset_id}`,
    type: 'relationship',
    data: {
      relationship: rel,
      label: rel.name ?? `${rel.relationship_type} (${rel.join_type})`,
    },
  }));
}

// ---------------------------------------------------------------------------
// Hierarchical Dataset Selector (collapsible tree)
// ---------------------------------------------------------------------------

interface HierarchicalSelectorProps {
  enrichedDatasets: DatasetSummary[];
  onAddDataset: (id: number) => void;
  relatedIds: Set<number>;
  onFilterChange: (database: string | undefined, schema: string | undefined) => void;
}

interface SchemaGroup {
  schema: string;
  datasets: DatasetSummary[];
  collapsed: boolean;
}

interface DbGroup {
  dbName: string;
  schemas: SchemaGroup[];
  collapsed: boolean;
}

function HierarchicalDatasetSelector({
  enrichedDatasets,
  onAddDataset,
  relatedIds,
  onFilterChange,
}: HierarchicalSelectorProps) {
  // Build hierarchical tree: Database → Schema → Datasets
  const tree = useMemo(() => {
    const dbMap = new Map<string, Map<string, DatasetSummary[]>>();

    enrichedDatasets.forEach(ds => {
      const dbName = ds.database?.database_name ?? 'Unknown';
      const schemaName = ds.schema ?? 'public';

      if (!dbMap.has(dbName)) {
        dbMap.set(dbName, new Map());
      }
      const schemaMap = dbMap.get(dbName)!;
      if (!schemaMap.has(schemaName)) {
        schemaMap.set(schemaName, []);
      }
      schemaMap.get(schemaName)!.push(ds);
    });

    const result: DbGroup[] = [];
    dbMap.forEach((schemaMap, dbName) => {
      const schemas: SchemaGroup[] = [];
      schemaMap.forEach((datasets, schema) => {
        schemas.push({
          schema,
          datasets: datasets.sort((a, b) => a.table_name.localeCompare(b.table_name)),
          collapsed: false,
        });
      });
      result.push({
        dbName,
        schemas: schemas.sort((a, b) => a.schema.localeCompare(b.schema)),
        collapsed: false,
      });
    });

    return result.sort((a, b) => a.dbName.localeCompare(b.dbName));
  }, [enrichedDatasets]);

  const [collapsedDbs, setCollapsedDbs] = useState<Set<string>>(new Set());
  const [collapsedSchemas, setCollapsedSchemas] = useState<Set<string>>(new Set());
  const [selectedDb, setSelectedDb] = useState<string | undefined>(undefined);
  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(undefined);

  const toggleDb = useCallback((dbName: string) => {
    setCollapsedDbs(prev => {
      const next = new Set(prev);
      if (next.has(dbName)) next.delete(dbName);
      else next.add(dbName);
      return next;
    });
  }, []);

  const toggleSchema = useCallback((schemaKey: string) => {
    setCollapsedSchemas(prev => {
      const next = new Set(prev);
      if (next.has(schemaKey)) next.delete(schemaKey);
      else next.add(schemaKey);
      return next;
    });
  }, []);

  const handleDbClick = useCallback((dbName: string) => {
    const newDb = selectedDb === dbName ? undefined : dbName;
    setSelectedDb(newDb);
    setSelectedSchema(undefined);
    onFilterChange(newDb, undefined);
  }, [selectedDb, onFilterChange]);

  const handleSchemaClick = useCallback(
    (dbName: string, schema: string) => {
      const newSchema = selectedDb === dbName && selectedSchema === schema ? undefined : schema;
      setSelectedSchema(newSchema);
      onFilterChange(selectedDb, newSchema);
    },
    [selectedDb, selectedSchema, onFilterChange],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontSize: '12px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#999',
          marginBottom: 4,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Datasets
      </div>

      {/* Collapsible Quick Select */}
      <div
        style={{
          marginBottom: 8,
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: 4,
        }}
      >
        {/* Database filter controls */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {tree.map(db => (
            <button
              key={db.dbName}
              type="button"
              onClick={() => handleDbClick(db.dbName)}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                border: `1px solid ${selectedDb === db.dbName ? '#2893B3' : '#e0e0e0'}`,
                borderRadius: 4,
                background: selectedDb === db.dbName ? '#e0f0f5' : '#fafafa',
                color: selectedDb === db.dbName ? '#1a6d85' : '#666',
                cursor: 'pointer',
                fontWeight: selectedDb === db.dbName ? 600 : 400,
              }}
            >
              {db.dbName}
            </button>
          ))}
        </div>

        {/* Schema filters (shown when DB is selected) */}
        {selectedDb && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {tree
              .find(db => db.dbName === selectedDb)
              ?.schemas.map(sch => (
                <button
                  key={`${selectedDb}-${sch.schema}`}
                  type="button"
                  onClick={() => handleSchemaClick(selectedDb, sch.schema)}
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    border: `1px solid ${selectedSchema === sch.schema ? '#2893B3' : '#e0e0e0'}`,
                    borderRadius: 3,
                    background: selectedSchema === sch.schema ? '#e0f0f5' : '#fafafa',
                    color: selectedSchema === sch.schema ? '#1a6d85' : '#888',
                    cursor: 'pointer',
                    fontWeight: selectedSchema === sch.schema ? 600 : 400,
                  }}
                >
                  {sch.schema}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Dataset tree */}
      <div
        style={{
          maxHeight: 300,
          overflowY: 'auto',
          border: '1px solid #e8e8e8',
          borderRadius: 6,
          background: '#fff',
        }}
      >
        {tree.map(db => {
          const isDbCollapsed = collapsedDbs.has(db.dbName);
          const isDbSelected = selectedDb === db.dbName;

          return (
            <div key={db.dbName}>
              {/* Database header */}
              <div
                onClick={() => toggleDb(db.dbName)}
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isDbSelected ? '#1a6d85' : '#555',
                  background: isDbSelected ? '#e0f0f5' : '#fafafa',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: '10px', color: '#999', width: 14 }}>
                  {isDbCollapsed ? '▶' : '▼'}
                </span>
                <span style={{ flex: 1 }}>{db.dbName}</span>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#999',
                    background: '#f0f0f0',
                    padding: '0 5px',
                    borderRadius: 8,
                  }}
                >
                  {db.schemas.reduce((sum, s) => sum + s.datasets.length, 0)}
                </span>
              </div>

              {/* Schema items (collapsible) */}
              {!isDbCollapsed &&
                db.schemas.map(sch => {
                  const schemaKey = `${db.dbName}-${sch.schema}`;
                  const isSchCollapsed = collapsedSchemas.has(schemaKey);
                  const isSchemaSelected = selectedDb === db.dbName && selectedSchema === sch.schema;

                  return (
                    <div key={schemaKey}>
                      {/* Schema header */}
                      <div
                        onClick={() => toggleSchema(schemaKey)}
                        style={{
                          padding: '4px 10px 4px 24px',
                          fontSize: '10px',
                          color: '#888',
                          background: isSchemaSelected ? '#f0f7fa' : '#fff',
                          borderBottom: '1px solid #f5f5f5',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ fontSize: '8px', color: '#ccc', width: 12 }}>
                          {isSchCollapsed ? '▶' : '▼'}
                        </span>
                        <span>{sch.schema}</span>
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#bbb',
                            marginLeft: 'auto',
                          }}
                        >
                          {sch.datasets.length} datasets
                        </span>
                      </div>

                      {/* Dataset items (collapsible) */}
                      {!isSchCollapsed &&
                        sch.datasets.map(ds => {
                          const isAdded = relatedIds.has(ds.id);
                          return (
                            <div
                              key={ds.id}
                              onClick={() => {
                                if (!isAdded) {
                                  onAddDataset(ds.id);
                                }
                              }}
                              style={{
                                padding: '4px 10px 4px 36px',
                                fontSize: '11px',
                                cursor: isAdded ? 'default' : 'pointer',
                                background: isAdded ? '#f9f9f9' : '#fff',
                                color: isAdded ? '#bbb' : '#444',
                                borderBottom: '1px solid #f5f5f5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={e => {
                                if (!isAdded) {
                                  (e.currentTarget as HTMLDivElement).style.background = '#e0f0f5';
                                }
                              }}
                              onMouseLeave={e => {
                                if (!isAdded) {
                                  (e.currentTarget as HTMLDivElement).style.background = '#fff';
                                }
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: isAdded ? '#52c41a' : '#e0e0e0',
                                  display: 'inline-block',
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {ds.table_name}
                              </span>
                              {isAdded && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    color: '#52c41a',
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}

        {tree.length === 0 && (
          <div style={{ padding: 16, color: '#999', fontSize: '12px', textAlign: 'center' }}>
            No datasets available.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface RelationshipCanvasProps {
  datasetId?: number;
  onClose?: () => void;
}

export default function RelationshipCanvas({
  datasetId,
  onClose,
}: RelationshipCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Data hooks
  const { relationships, loading: relLoading, refresh: refreshRelationships } =
    useRelationships(datasetId);
  const { datasets, loading: dsLoading } =
    useDatasetList();
  const { enrichDatasets } = useDatasetColumnsEnricher();
  const { create } = useCreateRelationship();
  const { update } = useUpdateRelationship();
  const { remove } = useDeleteRelationship();

  const [manuallyAddedIds, setManuallyAddedIds] = useState<Set<number>>(new Set());
  const [enrichedDatasets, setEnrichedDatasets] = useState<DatasetSummary[]>([]);
  const [filterDb, setFilterDb] = useState<string | undefined>(undefined);
  const [filterSchema, setFilterSchema] = useState<string | undefined>(undefined);

  // Enrich datasets with columns when they change
  useEffect(() => {
    if (dsLoading) return;
    enrichDatasets(datasets).then(setEnrichedDatasets);
  }, [datasets, dsLoading, enrichDatasets]);

  // Filter handler from hierarchical selector
  const handleFilterChange = useCallback((db: string | undefined, schema: string | undefined) => {
    setFilterDb(db);
    setFilterSchema(schema);
  }, []);

  // Filter datasets by selected database + schema
  const filteredDatasets = useMemo(() => {
    if (!filterDb || !filterSchema) return enrichedDatasets;
    return enrichedDatasets.filter(
      ds =>
        ds.database?.database_name === filterDb &&
        (ds.schema ?? 'public') === filterSchema,
    );
  }, [enrichedDatasets, filterDb, filterSchema]);

  // Filter relationships to only those involving visible datasets
  const filteredRelationships = useMemo(() => {
    if (!filterDb || !filterSchema) return relationships;
    const visibleIds = new Set(filteredDatasets.map(ds => ds.id));
    return relationships.filter(
      r => visibleIds.has(r.source_dataset_id) && visibleIds.has(r.target_dataset_id),
    );
  }, [relationships, filteredDatasets, filterDb, filterSchema]);

  const loading = relLoading || dsLoading;

  const initialNodes = useMemo(
    () => computeAutoLayout(filteredDatasets, filteredRelationships, manuallyAddedIds),
    [filteredDatasets, filteredRelationships, manuallyAddedIds],
  );
  const initialEdges = useMemo(
    () => relationshipsToEdges(filteredRelationships),
    [filteredRelationships],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(computeAutoLayout(filteredDatasets, filteredRelationships, manuallyAddedIds));
    setEdges(relationshipsToEdges(relationships));
  }, [filteredDatasets, filteredRelationships, manuallyAddedIds, setNodes, setEdges, relationships]);

  // Dataset selector: compute related IDs for showing "added" state
  const relatedIds = useMemo(() => {
    const ids = new Set<number>();
    relationships.forEach(rel => {
      ids.add(rel.source_dataset_id);
      ids.add(rel.target_dataset_id);
    });
    manuallyAddedIds.forEach(id => ids.add(id));
    return ids;
  }, [relationships, manuallyAddedIds]);

  const handleAddDataset = useCallback(
    (id: number) => {
      setManuallyAddedIds(prev => new Set(prev).add(id));
    },
    [],
  );

  const [selectedRelationship, setSelectedRelationship] =
    useState<DatasetRelationship | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Pending connection - now includes optional pre-selected column names
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: number;
    targetId: number;
    sourceColumn?: string;
    targetColumn?: string;
  } | null>(null);
  const [showNewRelPicker, setShowNewRelPicker] = useState(false);

  const getRelationshipByEdgeId = useCallback(
    (edgeId: string): DatasetRelationship | null => {
      const relId = parseInt(edgeId.replace('relationship-', ''), 10);
      return relationships.find(r => r.id === relId) ?? null;
    },
    [relationships],
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { id: string }) => {
      const rel = getRelationshipByEdgeId(edge.id);
      setSelectedRelationship(rel);
      setSelectedEdgeId(edge.id);
    },
    [getRelationshipByEdgeId],
  );

  /**
   * Handle column-level connections.
   * Handle IDs are formatted as:
   *   source-{datasetId}-{columnName}
   *   target-{datasetId}-{columnName}
   */
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceId = parseInt(connection.source.replace('dataset-', ''), 10);
      const targetId = parseInt(connection.target.replace('dataset-', ''), 10);

      // Extract column names from handle IDs
      let sourceColumn: string | undefined;
      let targetColumn: string | undefined;

      if (connection.sourceHandle) {
        const parts = connection.sourceHandle.split('-');
        if (parts.length >= 3) {
          sourceColumn = parts.slice(2).join('-');
        }
      }

      if (connection.targetHandle) {
        const parts = connection.targetHandle.split('-');
        if (parts.length >= 3) {
          targetColumn = parts.slice(2).join('-');
        }
      }

      // If both columns identified, create relationship directly (no modal)
      if (sourceColumn && targetColumn) {
        try {
          await create({
            source_dataset_id: sourceId,
            target_dataset_id: targetId,
            relationship_type: 'many_to_one',
            join_type: 'LEFT',
            name: `${sourceColumn} → ${targetColumn}`,
            columns: [{
              source_column_name: sourceColumn,
              target_column_name: targetColumn,
              operator: '=',
              ordinal: 0,
            }],
          });
          refreshRelationships();
        } catch {
          // Error toast handled by hook
        }
        return;
      }

      // Fallback: if columns not identified from handles, show picker modal
      setPendingConnection({ sourceId, targetId, sourceColumn, targetColumn });
      setShowNewRelPicker(true);
    },
    [create, refreshRelationships],
  );

  const handleCreateRelationship = useCallback(
    async (columns: RelationshipColumn[]) => {
      if (!pendingConnection) return;
      try {
        await create({
          source_dataset_id: pendingConnection.sourceId,
          target_dataset_id: pendingConnection.targetId,
          relationship_type: 'many_to_one',
          join_type: 'LEFT',
          columns,
        });
        refreshRelationships();
        setShowNewRelPicker(false);
        setPendingConnection(null);
      } catch {
        // Error toast handled by hook
      }
    },
    [pendingConnection, create, refreshRelationships],
  );

  const handleUpdateRelationship = useCallback(
    async (id: number, data: Partial<DatasetRelationship>) => {
      try {
        await update(id, data);
        refreshRelationships();
        const updated = relationships.find(r => r.id === id);
        if (updated) {
          setSelectedRelationship({ ...updated, ...data } as DatasetRelationship);
        }
      } catch {
        // Error toast handled by hook
      }
    },
    [update, refreshRelationships, relationships],
  );

  const handleDeleteRelationship = useCallback(
    async (id: number) => {
      try {
        await remove(id);
        setSelectedRelationship(null);
        setSelectedEdgeId(null);
        refreshRelationships();
      } catch {
        // Error toast handled by hook
      }
    },
    [remove, refreshRelationships],
  );

  const onPaneClick = useCallback(() => {
    setSelectedRelationship(null);
    setSelectedEdgeId(null);
  }, []);

  const sourceDs = selectedRelationship
    ? enrichedDatasets.find(d => d.id === selectedRelationship.source_dataset_id) ?? null
    : pendingConnection
      ? enrichedDatasets.find(d => d.id === pendingConnection.sourceId) ?? null
      : null;

  const targetDs = selectedRelationship
    ? enrichedDatasets.find(d => d.id === selectedRelationship.target_dataset_id) ?? null
    : pendingConnection
      ? enrichedDatasets.find(d => d.id === pendingConnection.targetId) ?? null
      : null;

  // Build initial columns from column-level drag if present
  const pickerInitialColumns = useMemo(() => {
    if (!pendingConnection?.sourceColumn || !pendingConnection?.targetColumn) {
      return undefined;
    }
    return [{
      source_column_name: pendingConnection.sourceColumn,
      target_column_name: pendingConnection.targetColumn,
      operator: '=' as const,
      ordinal: 0,
    }];
  }, [pendingConnection]);

  // Auto-layout handler
  const handleAutoLayout = useCallback(() => {
    setNodes(computeAutoLayout(filteredDatasets, filteredRelationships, manuallyAddedIds));
  }, [filteredDatasets, filteredRelationships, manuallyAddedIds, setNodes]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 400,
          color: '#999',
        }}
      >
        Loading relationships…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 500,
        border: '1px solid #e8e8e8',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar LEFT */}
      {(!selectedRelationship || !selectedEdgeId) && (
        <div
          style={{
            width: 320,
            borderRight: '1px solid #e8e8e8',
            background: '#fafafa',
            overflowY: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Hierarchical Add Dataset selector */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8', flexShrink: 0 }}>
            <HierarchicalDatasetSelector
              enrichedDatasets={enrichedDatasets}
              onAddDataset={handleAddDataset}
              relatedIds={relatedIds}
              onFilterChange={handleFilterChange}
            />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <RelationshipSidebar
              relationship={selectedRelationship}
              sourceDataset={sourceDs}
              targetDataset={targetDs}
              allRelationships={relationships}
              allDatasets={enrichedDatasets}
              onUpdate={handleUpdateRelationship}
              onDelete={handleDeleteRelationship}
              onClose={() => {
                setSelectedRelationship(null);
                setSelectedEdgeId(null);
              }}
              onSelectRelationship={(rel) => {
                setSelectedRelationship(rel);
                setSelectedEdgeId(`relationship-${rel.id}`);
              }}
              pendingConnection={pendingConnection ? { sourceId: pendingConnection.sourceId, targetId: pendingConnection.targetId } : null}
              onCreateFromPending={handleCreateRelationship}
              onCancelPending={() => {
                setPendingConnection(null);
                setShowNewRelPicker(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Canvas area */}
      <div
        ref={reactFlowWrapper}
        style={{ flex: 1, height: '100%', position: 'relative' }}
      >
        {/* Auto Layout button */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 5,
          }}
        >
          <Button
            buttonSize="xsmall"
            buttonStyle="tertiary"
            onClick={handleAutoLayout}
            style={{
              fontSize: '11px',
              background: '#fff',
              border: '1px solid #d9d9d9',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            Auto Layout
          </Button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as OnNodesChange}
          onEdgesChange={onEdgesChange as OnEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick as (event: React.MouseEvent, edge: { id: string }) => void}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectOnClick={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ background: '#fafafa' }}
        >
          <Controls
            style={{
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          />
          <MiniMap
            nodeColor={(n) => {
              const ds = (n as DatasetNodeType)?.data?.dataset;
              if (ds?.database?.database_name) {
                // Use database name for color
                let hash = 0;
                for (let i = 0; i < ds.database.database_name.length; i++) {
                  hash = ds.database.database_name.charCodeAt(i) + ((hash << 5) - hash);
                }
                const hue = Math.abs(hash) % 360;
                return `hsl(${hue}, 50%, 60%)`;
              }
              return n.selected ? '#2893B3' : '#ccc';
            }}
            style={{
              background: '#fafafa',
              border: '1px solid #ddd',
              borderRadius: 6,
            }}
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#e0e0e0"
          />
        </ReactFlow>
      </div>

      {/* New Relationship Column Picker */}
      <ColumnPickerModal
        show={showNewRelPicker}
        sourceDataset={
          pendingConnection
            ? enrichedDatasets.find(d => d.id === pendingConnection.sourceId) ?? null
            : null
        }
        targetDataset={
          pendingConnection
            ? enrichedDatasets.find(d => d.id === pendingConnection.targetId) ?? null
            : null
        }
        initialColumns={pickerInitialColumns}
        onSave={handleCreateRelationship}
        onHide={() => {
          setShowNewRelPicker(false);
          setPendingConnection(null);
        }}
      />
    </div>
  );
}
