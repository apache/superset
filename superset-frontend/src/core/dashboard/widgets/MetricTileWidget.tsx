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
import { styled, useTheme } from '@apache-superset/core/theme';
import { Flex, Loading, Typography } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider, useDashboardRevision } from '../store';
import { fetchQueryData } from '../chartData';
import { getActiveFiltersForDataset } from '../collectActiveFilters';

type DataBindingSpec = dashboardApi.DataBindingSpec;
type Theme = ReturnType<typeof useTheme>;

interface DeltaSpec {
  value: number;
  direction?: 'up' | 'down' | 'flat';
  suffix?: string;
}

// The && bumps specificity above antd's own Title margin rules, which a
// plain inline style prop can't override (same trick as
// `DashboardBuilderV2`'s own `HeaderTitle`) — without it the default margin
// throws off vertical centering against the label/delta stacked below it.
const BigNumber = styled(Typography.Title)`
  && {
    margin: 0;
    line-height: 1.1;
  }
`;

function formatNumber(value: unknown, decimals: number): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (value == null || Number.isNaN(num))
    return value == null ? '—' : String(value);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

function DeltaIndicator({ delta, theme }: { delta: DeltaSpec; theme: Theme }) {
  const direction =
    delta.direction ??
    (delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat');
  const color =
    direction === 'up'
      ? theme.colorSuccess
      : direction === 'down'
        ? theme.colorError
        : theme.colorTextSecondary;
  const Icon =
    direction === 'up'
      ? Icons.CaretUpOutlined
      : direction === 'down'
        ? Icons.CaretDownOutlined
        : undefined;

  return (
    <Flex align="center" gap={4}>
      {Icon && <Icon style={{ color }} />}
      <Typography.Text style={{ color }}>
        {formatNumber(Math.abs(delta.value), 1)}
        {delta.suffix ?? ''}
      </Typography.Text>
    </Flex>
  );
}

/**
 * The built-in `metric-tile` widget ("big number") — registered
 * like any other widget (see `registerBuiltInWidgets`). Fetches its
 * `dataBinding` the same generic way `ChartWidget`/`AgGridTableWidget` do, and
 * renders the first result row's value directly as text — no ECharts
 * gauge/`graphic` text workaround (what an AI reached for before this widget
 * existed), and no `$bind` splicing, since there's nothing here to splice
 * into: the whole point of this widget is a single live number.
 *
 * `dataBinding` is expected to resolve one column (one metric, no
 * `dimensions`) — the value shown is always the *first* row's value for
 * that column; a tile shows one number, so grouping isn't meaningful here
 * the way it is for a chart or table.
 */
export default function MetricTileWidget({ nodeId }: { nodeId: string }) {
  // Covers both structural/layout changes and any filter's emitted value —
  // `dashboard.emit` ticks the same revision (see `DashboardProvider`).
  useDashboardRevision();
  const theme = useTheme();
  const [value, setValue] = useState<unknown>(undefined);
  const [columnLabel, setColumnLabel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
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
      setError('This metric tile has no dataBinding.');
      setLoaded(false);
      return undefined;
    }
    let cancelled = false;
    setError(null);
    setLoaded(false);
    fetchQueryData(effectiveBinding)
      .then(result => {
        if (cancelled) return;
        const [column] = result.columns;
        setColumnLabel(column ?? null);
        setValue(column ? result.rows[0]?.[column] : undefined);
        setLoaded(true);
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

  const decimals = (node.props?.decimals as number | undefined) ?? 0;
  const prefix = (node.props?.prefix as string | undefined) ?? '';
  const suffix = (node.props?.suffix as string | undefined) ?? '';
  const label = (node.props?.label as string | undefined) ?? columnLabel ?? '';
  const delta = node.props?.delta as DeltaSpec | undefined;

  return (
    <Flex
      vertical
      justify="center"
      style={{
        // Fills the box `WidgetView`'s placement wrapper gives this
        // widget — always a definite pixel box, same as `ChartWidget`.
        width: '100%',
        height: '100%',
        // Surface, border, corners and inset all belong to the card
        // `WidgetView` draws around this widget and the name above
        // it, so that the name is inside the frame rather than over it.
        overflow: 'hidden',
      }}
    >
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      {!error && !loaded && <Loading position="inline-centered" size="s" />}
      {!error && loaded && (
        <>
          <BigNumber level={2}>
            {prefix}
            {formatNumber(value, decimals)}
            {suffix}
          </BigNumber>
          {label && (
            <Typography.Text
              type="secondary"
              style={{ marginTop: theme.marginXS }}
            >
              {label}
            </Typography.Text>
          )}
          {delta && (
            <div style={{ marginTop: theme.marginXS }}>
              <DeltaIndicator delta={delta} theme={theme} />
            </div>
          )}
        </>
      )}
    </Flex>
  );
}
