/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  This ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except be agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { Button, Select } from '@superset-ui/core/components';
import type {
  RelationshipColumn,
  ColumnOperator,
  DatasetSummary,
} from '../../types';

interface ColumnPickerModalProps {
  show: boolean;
  sourceDataset: DatasetSummary | null;
  targetDataset: DatasetSummary | null;
  initialColumns?: RelationshipColumn[];
  onSave: (columns: RelationshipColumn[]) => void;
  onHide: () => void;
}

interface ColumnPair {
  id: string;
  source_column_name: string;
  target_column_name: string;
  operator: ColumnOperator;
  ordinal: number;
}

const OPERATOR_OPTIONS = [
  { value: '=', label: '= (equals)' },
  { value: '!=', label: '!= (not equals)' },
  { value: '>', label: '> (greater than)' },
  { value: '<', label: '< (less than)' },
  { value: '>=', label: '>= (greater or equal)' },
  { value: '<=', label: '<= (less or equal)' },
];

export default function ColumnPickerModal({
  show,
  sourceDataset,
  targetDataset,
  initialColumns,
  onSave,
  onHide,
}: ColumnPickerModalProps) {
  // Enriched datasets with full column info fetched individually
  const [enrichedSource, setEnrichedSource] = useState<DatasetSummary | null>(null);
  const [enrichedTarget, setEnrichedTarget] = useState<DatasetSummary | null>(null);
  const [columnsLoading, setColumnsLoading] = useState(false);

  // When modal opens, fetch full dataset details if columns are missing
  useEffect(() => {
    if (!show) {
      setEnrichedSource(null);
      setEnrichedTarget(null);
      return;
    }

    const fetchDataset = async (ds: DatasetSummary | null): Promise<DatasetSummary | null> => {
      if (!ds) return null;
      // If columns already present, use as-is
      if (ds.columns && ds.columns.length > 0) return ds;
      // Otherwise fetch full dataset details
      const { json } = await SupersetClient.get({ endpoint: `/api/v1/dataset/${ds.id}` });
      return json as unknown as DatasetSummary;
    };

    let cancelled = false;
    setColumnsLoading(true);
    Promise.all([fetchDataset(sourceDataset), fetchDataset(targetDataset)])
      .then(([src, tgt]) => {
        if (!cancelled) {
          setEnrichedSource(src);
          setEnrichedTarget(tgt);
          setColumnsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setColumnsLoading(false);
      });

    return () => { cancelled = true; };
  }, [show, sourceDataset, targetDataset]);

  const effectiveSource = enrichedSource ?? sourceDataset;
  const effectiveTarget = enrichedTarget ?? targetDataset;

  const sourceColumnOptions = useMemo(
    () =>
      (effectiveSource?.columns ?? []).map(c => ({
        value: c.column_name,
        label: `${c.column_name} (${c.type ?? ''})`,
      })),
    [effectiveSource],
  );

  const targetColumnOptions = useMemo(
    () =>
      (effectiveTarget?.columns ?? []).map(c => ({
        value: c.column_name,
        label: `${c.column_name} (${c.type ?? ''})`,
      })),
    [effectiveTarget],
  );

  const [pairs, setPairs] = useState<ColumnPair[]>(() =>
    (initialColumns ?? [{ source_column_name: '', target_column_name: '', operator: '=' as ColumnOperator, ordinal: 0 }]).map(
      (col, i) => ({
        id: `pair-${i}-${Date.now()}`,
        source_column_name: col.source_column_name,
        target_column_name: col.target_column_name,
        operator: col.operator,
        ordinal: i,
      }),
    ),
  );

  const updatePair = useCallback(
    (pairId: string, field: keyof ColumnPair, value: string) => {
      setPairs(prev =>
        prev.map(p => (p.id === pairId ? { ...p, [field]: value } : p)),
      );
    },
    [],
  );

  const addPair = useCallback(() => {
    setPairs(prev => [
      ...prev,
      {
        id: `pair-${prev.length}-${Date.now()}`,
        source_column_name: '',
        target_column_name: '',
        operator: '=' as ColumnOperator,
        ordinal: prev.length,
      },
    ]);
  }, []);

  const removePair = useCallback((pairId: string) => {
    setPairs(prev => prev.filter(p => p.id !== pairId));
  }, []);

  const handleSave = useCallback(() => {
    const cleaned = pairs
      .filter(p => p.source_column_name && p.target_column_name)
      .map((p, i) => ({
        source_column_name: p.source_column_name,
        target_column_name: p.target_column_name,
        operator: p.operator,
        ordinal: i,
      }));
    if (cleaned.length > 0) {
      onSave(cleaned);
    }
  }, [pairs, onSave]);

  const isValid = pairs.some(
    p => p.source_column_name && p.target_column_name,
  );

  return (
    <>
    {show && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 9999,
      }}>
        <div style={{
          background: '#fff', borderRadius: 8, padding: 24, width: 600,
          maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Configure Column Mappings</h3>
      {columnsLoading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
          Loading columns…
        </div>
      ) : (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {pairs.map(pair => (
          <div
            key={pair.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              background: '#fafafa',
              borderRadius: 4,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '12px',
                  color: '#999',
                  marginBottom: 4,
                }}
              >
                Source Column
              </div>
              <Select
                value={pair.source_column_name || undefined}
                options={sourceColumnOptions}
                onChange={(v: string) =>
                  updatePair(pair.id, 'source_column_name', v)
                }
                placeholder="Select column…"
              />
            </div>

            <div style={{ width: 100, flexShrink: 0 }}>
              <div
                style={{
                  fontSize: '12px',
                  color: '#999',
                  marginBottom: 4,
                }}
              >
                Operator
              </div>
              <Select
                value={pair.operator}
                options={OPERATOR_OPTIONS}
                onChange={(v: string) =>
                  updatePair(pair.id, 'operator', v)
                }
              />
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '12px',
                  color: '#999',
                  marginBottom: 4,
                }}
              >
                Target Column
              </div>
              <Select
                value={pair.target_column_name || undefined}
                options={targetColumnOptions}
                onChange={(v: string) =>
                  updatePair(pair.id, 'target_column_name', v)
                }
                placeholder="Select column…"
              />
            </div>

            {pairs.length > 1 && (
              <Button
                buttonSize="xsmall"
                buttonStyle="danger"
                onClick={() => removePair(pair.id)}
                style={{ marginTop: 16 }}
              >
                ✕
              </Button>
            )}
          </div>
        ))}

        <Button
          buttonSize="small"
          buttonStyle="tertiary"
          onClick={addPair}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add Column Pair
        </Button>
      </div>
      )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button buttonSize="small" buttonStyle="secondary" onClick={onHide}>Cancel</Button>
            <Button buttonSize="small" buttonStyle="primary" onClick={handleSave} disabled={!isValid || columnsLoading}>Save Mappings</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
