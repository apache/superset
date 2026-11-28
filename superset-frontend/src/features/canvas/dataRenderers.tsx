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
import { useMemo } from 'react';
import type { CanvasRendererProps } from 'src/core/canvas/types';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { getNumberFormatter, NumberFormats } from '@superset-ui/core';
import {
  Statistic,
  Table,
  TableSize,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
import { useWidgetRows } from './useWidgetRows';
import WithQuery from './WithQuery';
import { WidgetError, WidgetNoData, WidgetSkeleton } from './WidgetStates';

type Props = CanvasRendererProps;

const Tile = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${theme.sizeUnit}px;
  `}
`;

/** Shown for a metric with no value, which SMART_NUMBER would print as "null". */
export const NO_VALUE = '--';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** What each metric of a binding is called in its rows. */
const metricLabels = (binding: unknown): string[] => {
  const metrics = (binding as { metrics?: unknown[] } | undefined)?.metrics;
  if (!Array.isArray(metrics)) return [];
  return metrics
    .map(metric =>
      typeof metric === 'string'
        ? metric
        : (metric as { label?: unknown } | null)?.label,
    )
    .filter((label): label is string => typeof label === 'string');
};

/** The metric as a compact number, with the full figure in a tooltip. */
export function formatMetric(
  value: number | null | undefined,
  decimals = 0,
): { short: string; full: string } {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { short: NO_VALUE, full: NO_VALUE };
  }
  return {
    short: getNumberFormatter(NumberFormats.SMART_NUMBER)(value),
    full: getNumberFormatter(decimals > 0 ? `,.${decimals}f` : ',')(value),
  };
}

/** The first row's value of the tile's metric, as a big number. */
export function MetricTileRenderer(widget: Props) {
  const { props, filters, refreshKey, title } = widget;
  const theme = useTheme();
  const { rows, loading, error, query, language, datasource, retry } =
    useWidgetRows(widget, filters, refreshKey);
  if (loading && rows.length === 0) return <WidgetSkeleton shape="metric" />;
  if (error) return <WidgetError message={error} onRetry={retry} />;
  if (rows.length === 0) return <WidgetNoData filtered={filters.length > 0} />;
  const row = rows[0];
  // The binding's own metric first: a dimension can be numeric too.
  const column =
    metricLabels(props?.dataBinding).find(label => label in row) ??
    Object.keys(row).find(key => typeof row[key] === 'number');
  const raw = column ? row[column] : undefined;
  const value = typeof raw === 'number' ? raw : null;
  const decimals = typeof props?.decimals === 'number' ? props.decimals : 0;
  const { short, full } = formatMetric(value, decimals);
  const prefix = text(props?.prefix);
  const suffix = text(props?.suffix);
  // The card's title is the label; only an untitled tile names it here.
  const label = title ? '' : text(props?.label) || column;
  return (
    <WithQuery query={query} language={language} datasource={datasource}>
      <Tile>
        <Tooltip
          title={value === null ? undefined : `${prefix}${full}${suffix}`}
        >
          <Statistic
            value={short}
            formatter={() => short}
            prefix={prefix || undefined}
            suffix={suffix || undefined}
            styles={{
              content: {
                fontSize: theme.fontSizeHeading3,
                fontWeight: theme.fontWeightStrong,
              },
            }}
            data-test="canvas-metric-value"
          />
        </Tooltip>
        {label && <Typography.Text type="secondary">{label}</Typography.Text>}
      </Tile>
    </WithQuery>
  );
}

interface ColumnDef {
  field?: string;
  headerName?: string;
}

/** The query's rows as a table; `columnDefs` picks and names the columns. */
export function TableRenderer(widget: Props) {
  const { props, filters, refreshKey } = widget;
  const { rows, loading, error, query, language, datasource, retry } =
    useWidgetRows(widget, filters, refreshKey);
  const defs = (props?.columnDefs ?? []) as ColumnDef[];
  const columns = useMemo(() => {
    const fields = defs.length
      ? defs.filter(def => def.field)
      : Object.keys(rows[0] ?? {}).map(field => ({ field }) as ColumnDef);
    return fields.map(def => ({
      key: def.field as string,
      dataIndex: def.field as string,
      title: def.headerName || def.field,
      render: (value: unknown) =>
        typeof value === 'number'
          ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : String(value ?? ''),
    }));
  }, [defs, rows]);
  if (loading && rows.length === 0) return <WidgetSkeleton shape="table" />;
  if (error) return <WidgetError message={error} onRetry={retry} />;
  if (rows.length === 0) {
    return (
      <WithQuery query={query} language={language} datasource={datasource}>
        <WidgetNoData filtered={filters.length > 0} />
      </WithQuery>
    );
  }
  return (
    <WithQuery query={query} language={language} datasource={datasource}>
      <Table
        data={rows.map((row, index) => ({ key: index, ...row }))}
        columns={columns}
        loading={loading}
        size={TableSize.Small}
        usePagination={false}
        sticky
      />
    </WithQuery>
  );
}
