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
import { useMemo, ReactNode } from 'react';
import { InfoTooltip, TableView } from '@superset-ui/core/components';
import { styled, t } from '@superset-ui/core';
import { sortNumberWithMixedTypes, processTimeTableData } from './utils';
import { ValueCell, LeftCell, Sparkline } from './components';
import type { TimeTableProps } from './types';

// @z-index-above-dashboard-charts + 1 = 11
const TimeTableStyles = styled.div<{ height?: number }>`
  height: ${props => props.height}px;
  overflow: auto;

  th {
    z-index: 11 !important; // to cover sparkline
  }
`;

const TimeTable = ({
  className = '',
  height,
  data,
  columnConfigs,
  rowType,
  rows,
  url = '',
}: TimeTableProps) => {
  const memoizedColumns = useMemo(
    () => [
      {
        accessor: 'metric',
        Header: t('Metric'),
        id: 'metric', // REQUIRED: TableView needs both accessor and id to render rows
      },
      ...columnConfigs.map((columnConfig, i) => ({
        accessor: columnConfig.key,
        id: columnConfig.key, // REQUIRED: TableView needs both accessor and id to render rows
        cellProps: columnConfig.colType === 'spark' && {
          style: { width: '1%' },
        },
        Header: () => (
          <>
            {columnConfig.label}{' '}
            {columnConfig.tooltip && (
              <InfoTooltip
                tooltip={columnConfig.tooltip}
                label={`tt-col-${i}`}
                placement="top"
              />
            )}
          </>
        ),
        sortType: sortNumberWithMixedTypes,
      })),
    ],
    [columnConfigs],
  );

  const memoizedRows = useMemo(() => {
    const { entries, reversedEntries } = processTimeTableData(data);

    return rows.map(row => {
      const valueField = row.label || row.metric_name || '';
      const cellValues = columnConfigs.reduce<Record<string, ReactNode>>(
        (acc, columnConfig) => {
          if (columnConfig.colType === 'spark') {
            return {
              ...acc,
              [columnConfig.key]: (
                <Sparkline
                  valueField={valueField}
                  column={columnConfig}
                  entries={entries}
                />
              ),
            };
          }

          return {
            ...acc,
            [columnConfig.key]: (
              <ValueCell
                valueField={valueField}
                column={columnConfig}
                reversedEntries={reversedEntries}
              />
            ),
          };
        },
        {},
      );
      return {
        ...row,
        ...cellValues,
        metric: <LeftCell row={row} rowType={rowType} url={url} />,
      };
    });
  }, [columnConfigs, data, rowType, rows, url]);

  const defaultSort =
    rowType === 'column' && columnConfigs.length
      ? [
          {
            id: columnConfigs[0].key,
            desc: true,
          },
        ]
      : [];

  return (
    <TimeTableStyles
      data-test="time-table"
      className={className}
      height={height}
    >
      <TableView
        className="table-no-hover"
        columns={memoizedColumns}
        data={memoizedRows}
        initialSortBy={defaultSort}
        withPagination={false}
      />
    </TimeTableStyles>
  );
};

export default TimeTable;
