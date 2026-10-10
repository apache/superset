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
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  Empty,
  Loading,
  Table,
  TableSize,
  Typography,
} from '@superset-ui/core/components';
import type { DataBinding } from './echarts/chartData';
import { useWidgetRows } from './useWidgetRows';

type Props = canvasApi.CanvasWidgetProps;

const Tile = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: ${theme.sizeUnit}px;
  `}
`;

const BigNumber = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorTextHeading};
    font-size: ${theme.fontSizeHeading1}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: 1.1;
  `}
`;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** The first row's value of the tile's metric, as a big number. */
export function MetricTileRenderer({ props, filters, refreshKey }: Props) {
  const binding = props?.dataBinding as DataBinding | undefined;
  const { rows, loading, error } = useWidgetRows(binding, filters, refreshKey);
  if (loading) return <Loading position="inline-centered" />;
  if (error) return <Typography.Text type="danger">{error}</Typography.Text>;
  const row = rows[0] ?? {};
  const column = Object.keys(row).find(key => typeof row[key] === 'number');
  const value = column ? (row[column] as number) : undefined;
  const decimals = typeof props?.decimals === 'number' ? props.decimals : 0;
  return (
    <Tile>
      <BigNumber>
        {value === undefined
          ? '–'
          : `${text(props?.prefix)}${value.toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })}${text(props?.suffix)}`}
      </BigNumber>
      <Typography.Text type="secondary">
        {text(props?.label) || column}
      </Typography.Text>
    </Tile>
  );
}

interface ColumnDef {
  field?: string;
  headerName?: string;
}

/** The query's rows as a table; `columnDefs` picks and names the columns. */
export function TableRenderer({ props, filters, refreshKey }: Props) {
  const binding = props?.dataBinding as DataBinding | undefined;
  const { rows, loading, error } = useWidgetRows(binding, filters, refreshKey);
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
  if (error) return <Typography.Text type="danger">{error}</Typography.Text>;
  if (!loading && rows.length === 0) {
    return <Empty description={t('No data')} />;
  }
  return (
    <Table
      data={rows.map((row, index) => ({ key: index, ...row }))}
      columns={columns}
      loading={loading}
      size={TableSize.Small}
      usePagination={false}
      sticky
    />
  );
}
