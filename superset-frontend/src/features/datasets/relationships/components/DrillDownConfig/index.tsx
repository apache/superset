/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */

import { useState, useCallback, useMemo } from 'react';
import { Button, Input, Select } from '@superset-ui/core/components';
import { useDatasetList } from '../../hooks';
import type { DatasetSummary, DrillDownLevel, DrillDownHierarchy } from '../../types';

export type { DrillDownLevel, DrillDownHierarchy };

interface DrillDownConfigProps {
  show: boolean;
  hierarchies: DrillDownHierarchy[];
  onSave: (hierarchies: DrillDownHierarchy[]) => void;
  onHide: () => void;
}

export default function DrillDownConfigModal({
  show,
  hierarchies: initialHierarchies,
  onSave,
  onHide,
}: DrillDownConfigProps) {
  const { datasets } = useDatasetList();

  const [hierarchies, setHierarchies] =
    useState<DrillDownHierarchy[]>(initialHierarchies);

  const addHierarchy = useCallback(() => {
    setHierarchies(prev => [
      ...prev,
      {
        id: `hierarchy-${Date.now()}`,
        name: '',
        levels: [],
      },
    ]);
  }, []);

  const removeHierarchy = useCallback((hId: string) => {
    setHierarchies(prev => prev.filter(h => h.id !== hId));
  }, []);

  const updateHierarchyName = useCallback(
    (hId: string, name: string) => {
      setHierarchies(prev =>
        prev.map(h => (h.id === hId ? { ...h, name } : h)),
      );
    },
    [],
  );

  const addLevel = useCallback((hId: string) => {
    setHierarchies(prev =>
      prev.map(h =>
        h.id === hId
          ? {
              ...h,
              levels: [
                ...h.levels,
                {
                  dataset_id: 0,
                  column_name: '',
                  label: `Level ${h.levels.length + 1}`,
                },
              ],
            }
          : h,
      ),
    );
  }, []);

  const removeLevel = useCallback((hId: string, levelIdx: number) => {
    setHierarchies(prev =>
      prev.map(h =>
        h.id === hId
          ? { ...h, levels: h.levels.filter((_: unknown, i: number) => i !== levelIdx) }
          : h,
      ),
    );
  }, []);

  const updateLevel = useCallback(
    (
      hId: string,
      levelIdx: number,
      field: keyof DrillDownLevel,
      value: string | number,
    ) => {
      setHierarchies(prev =>
        prev.map(h =>
          h.id === hId
            ? {
                ...h,
                levels: h.levels.map((l: DrillDownLevel, i: number) =>
                  i === levelIdx ? { ...l, [field]: value } : l,
                ),
              }
            : h,
        ),
      );
    },
    [],
  );

  const getColumnsForDataset = useCallback(
    (datasetId: number) => {
      const ds = datasets.find((d: DatasetSummary) => d.id === datasetId);
      return (ds?.columns ?? []).map((c: { column_name: string; type: string }) => ({
        value: c.column_name,
        label: `${c.column_name} (${c.type ?? ''})`,
      }));
    },
    [datasets],
  );

  const datasetOptions = useMemo(
    () =>
      datasets.map((d: DatasetSummary) => ({
        value: d.id,
        label: `${d.table_name} (${d.database?.database_name ?? 'DB'})`,
      })),
    [datasets],
  );

  const handleSave = useCallback(() => {
    const valid = hierarchies.filter(
      h => h.name && h.levels.length >= 2 && h.levels.every((l: DrillDownLevel) => l.dataset_id && l.column_name),
    );
    onSave(valid);
  }, [hierarchies, onSave]);

  return (
    <>
    {show && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 9999,
      }}>
        <div style={{
          background: '#fff', borderRadius: 8, padding: 24, width: 700,
          maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Configure Drill-Down Hierarchies</h3>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxHeight: '60vh',
          overflowY: 'auto',
        }}
      >
        {hierarchies.map(hierarchy => (
          <div
            key={hierarchy.id}
            style={{
              border: '1px solid #e8e8e8',
              borderRadius: 4,
              padding: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Input
                value={hierarchy.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateHierarchyName(hierarchy.id, e.target.value)
                }
                placeholder="Hierarchy name (e.g., Geography)"
                style={{ flex: 1 }}
              />
              <Button
                buttonSize="xsmall"
                buttonStyle="danger"
                onClick={() => removeHierarchy(hierarchy.id)}
              >
                Remove
              </Button>
            </div>

            {hierarchy.levels.map((level: DrillDownLevel, levelIdx: number) => (
              <div
                key={levelIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  paddingLeft: 16,
                }}
              >
                <span
                  style={{
                    color: '#999',
                    fontSize: '12px',
                    width: 20,
                  }}
                >
                  {levelIdx + 1}.
                </span>

                <Select
                  value={level.dataset_id || undefined}
                  options={datasetOptions}
                  onChange={(v: unknown) =>
                    updateLevel(
                      hierarchy.id,
                      levelIdx,
                      'dataset_id',
                      v as number,
                    )
                  }
                  placeholder="Dataset"
                />

                <Select
                  value={level.column_name || undefined}
                  options={
                    level.dataset_id
                      ? getColumnsForDataset(level.dataset_id)
                      : []
                  }
                  onChange={(v: unknown) =>
                    updateLevel(
                      hierarchy.id,
                      levelIdx,
                      'column_name',
                      v as string,
                    )
                  }
                  placeholder="Column"
                />

                <Input
                  value={level.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateLevel(
                      hierarchy.id,
                      levelIdx,
                      'label',
                      e.target.value,
                    )
                  }
                  placeholder="Label"
                  style={{ width: 120 }}
                />

                <Button
                  buttonSize="xsmall"
                  buttonStyle="danger"
                  onClick={() => removeLevel(hierarchy.id, levelIdx)}
                >
                  ✕
                </Button>
              </div>
            ))}

            <Button
              buttonSize="xsmall"
              buttonStyle="tertiary"
              onClick={() => addLevel(hierarchy.id)}
              style={{ marginLeft: 16 }}
            >
              + Add Level
            </Button>
          </div>
        ))}

        <Button
          buttonSize="small"
          buttonStyle="primary"
          onClick={addHierarchy}
        >
          + Add Hierarchy
        </Button>
      </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button buttonSize="small" buttonStyle="secondary" onClick={onHide}>Cancel</Button>
            <Button buttonSize="small" buttonStyle="primary" onClick={handleSave}>Save Hierarchy</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
