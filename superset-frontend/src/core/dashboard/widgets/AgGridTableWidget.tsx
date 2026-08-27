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
import { useEffect, useState } from 'react';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import {
  Flex,
  Loading,
  ThemedAgGridReact,
  Typography,
} from '@superset-ui/core/components';
import type { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import { provider, useDashboardRevision } from '../store';
import { fetchQueryData } from '../chartData';
import { getActiveFiltersForDataset } from '../collectActiveFilters';

type DataBindingSpec = dashboardApi.DataBindingSpec;
type DataRow = dashboardApi.DataRow;

// No module registration needed here, unlike `ChartWidget`'s own
// `echarts.use([...])` call — `setupAGGridModules()` already runs
// unconditionally at app bootstrap (see `src/views/App.tsx`), well before
// this (or any other) AG Grid consumer ever renders.

function deriveColumnDefs(columns: string[]): ColDef[] {
  return columns.map(field => ({ field, headerName: field }));
}

/**
 * The built-in `ag-grid-table` widget — registered like any other
 * widget (see `registerBuiltInWidgets`). Fetches its `dataBinding`
 * (generic, viz_type-less — see `chartData.ts`) the same way `ChartWidget`
 * does, then hands the rows straight to AG Grid via the already-themed
 * `ThemedAgGridReact` wrapper. Unlike `echarts`, a table's `rowData`/
 * `columnDefs` map directly onto query results with no `$bind`-style
 * splicing needed — `columnDefs` can optionally be authored explicitly
 * (e.g. for custom headers, formatting, or widths), but when omitted,
 * columns are derived one-to-one from the query's own result columns.
 */
export default function AgGridTableWidget({ nodeId }: { nodeId: string }) {
  // Covers both structural/layout changes and any filter's emitted value —
  // `dashboard.emit` ticks the same revision (see `DashboardProvider`).
  useDashboardRevision();
  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [columns, setColumns] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const node = provider.getNode(nodeId);
  const dataBinding = node?.props?.dataBinding as DataBindingSpec | undefined;
  // See `ChartWidget` — same dataset-scoped filter merge, same reason.
  const effectiveBinding = dataBinding
    ? {
        ...dataBinding,
        filters: [
          ...(dataBinding.filters ?? []),
          ...getActiveFiltersForDataset(dataBinding.datasetId, nodeId),
        ],
      }
    : undefined;
  const bindingKey = JSON.stringify(effectiveBinding);

  useEffect(() => {
    if (!effectiveBinding) {
      setError('This table widget has no dataBinding.');
      setRows(null);
      setColumns(null);
      return undefined;
    }
    let cancelled = false;
    setError(null);
    setRows(null);
    setColumns(null);
    fetchQueryData(effectiveBinding)
      .then(result => {
        if (!cancelled) {
          setRows(result.rows);
          setColumns(result.columns);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // effectiveBinding is a fresh object every render — bindingKey is its
    // stable, value-equality-comparable proxy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey]);

  if (!node) return null;

  const columnDefs =
    (node.props?.columnDefs as ColDef[] | undefined) ??
    (columns ? deriveColumnDefs(columns) : undefined);

  return (
    <div
      style={{
        // Fills the box `WidgetView`'s placement wrapper gives this
        // widget — always a definite pixel box, same as `ChartWidget`.
        width: '100%',
        height: '100%',
        // Surface, border and corners belong to the card `WidgetView`
        // draws around this widget and the name above it, so that the name is
        // inside the frame rather than over it.
        overflow: 'hidden',
      }}
    >
      {error && (
        <Flex
          align="center"
          justify="center"
          style={{ width: '100%', height: '100%' }}
        >
          <Typography.Text type="danger">{error}</Typography.Text>
        </Flex>
      )}
      {!error && !rows && (
        <Flex
          align="center"
          justify="center"
          style={{ width: '100%', height: '100%' }}
        >
          <Loading position="inline-centered" size="s" />
        </Flex>
      )}
      {!error && rows && columnDefs && (
        <ThemedAgGridReact rowData={rows} columnDefs={columnDefs} />
      )}
    </div>
  );
}
