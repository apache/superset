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
import React from 'react';
import { styled, AdhocMetric, getNumberFormatter } from '@superset-ui/core';
// @ts-ignore
import PivotTable from '@superset-ui/react-pivottable/PivotTable';
// @ts-ignore
import { sortAs, aggregatorTemplates } from '@superset-ui/react-pivottable/Utilities';
import '@superset-ui/react-pivottable/pivottable.css';
import { PivotTableProps, PivotTableStylesProps } from './types';

const Styles = styled.div<PivotTableStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow-y: scroll;
  }
`;

// TODO: remove eslint-disable when click callbacks are implemented
/* eslint-disable @typescript-eslint/no-unused-vars */
const clickCellCallback = (
  e: MouseEvent,
  value: number,
  filters: Record<string, any>,
  pivotData: Record<string, any>,
) => {
  // TODO: Implement a callback
};

const clickColumnHeaderCallback = (
  e: MouseEvent,
  value: string,
  filters: Record<string, any>,
  pivotData: Record<string, any>,
  isSubtotal: boolean,
  isGrandTotal: boolean,
) => {
  // TODO: Implement a callback
};

const clickRowHeaderCallback = (
  e: MouseEvent,
  value: string,
  filters: Record<string, any>,
  pivotData: Record<string, any>,
  isSubtotal: boolean,
  isGrandTotal: boolean,
) => {
  // TODO: Implement a callback
};

export default function PivotTableChart(props: PivotTableProps) {
  const {
    data,
    height,
    width,
    groupbyRows,
    groupbyColumns,
    metrics,
    tableRenderer,
    colOrder,
    rowOrder,
    aggregateFunction,
    transposePivot,
    rowSubtotalPosition,
    colSubtotalPosition,
    colTotals,
    rowTotals,
    valueFormat,
  } = props;

  const adaptiveFormatter = getNumberFormatter(valueFormat);

  const aggregators = (tpl => ({
    Count: tpl.count(adaptiveFormatter),
    'Count Unique Values': tpl.countUnique(adaptiveFormatter),
    'List Unique Values': tpl.listUnique(', '),
    Sum: tpl.sum(adaptiveFormatter),
    Average: tpl.average(adaptiveFormatter),
    Median: tpl.median(adaptiveFormatter),
    'Sample Variance': tpl.var(1, adaptiveFormatter),
    'Sample Standard Deviation': tpl.stdev(1, adaptiveFormatter),
    Minimum: tpl.min(adaptiveFormatter),
    Maximum: tpl.max(adaptiveFormatter),
    First: tpl.first(adaptiveFormatter),
    Last: tpl.last(adaptiveFormatter),
    'Sum as Fraction of Total': tpl.fractionOf(tpl.sum(), 'total', adaptiveFormatter),
    'Sum as Fraction of Rows': tpl.fractionOf(tpl.sum(), 'row', adaptiveFormatter),
    'Sum as Fraction of Columns': tpl.fractionOf(tpl.sum(), 'col', adaptiveFormatter),
    'Count as Fraction of Total': tpl.fractionOf(tpl.count(), 'total', adaptiveFormatter),
    'Count as Fraction of Rows': tpl.fractionOf(tpl.count(), 'row', adaptiveFormatter),
    'Count as Fraction of Columns': tpl.fractionOf(tpl.count(), 'col', adaptiveFormatter),
  }))(aggregatorTemplates);

  const metricNames = metrics.map((metric: string | AdhocMetric) =>
    typeof metric === 'string' ? metric : (metric.label as string),
  );

  const unpivotedData = data.reduce(
    (acc: Record<string, any>[], record: Record<string, any>) => [
      ...acc,
      ...metricNames.map((name: string) => ({
        ...record,
        metric: name,
        value: record[name],
      })),
    ],
    [],
  );

  const [rows, cols] = transposePivot
    ? [groupbyColumns, ['metric', ...groupbyRows]]
    : [groupbyRows, ['metric', ...groupbyColumns]];

  return (
    <Styles height={height} width={width}>
      <PivotTable
        data={unpivotedData}
        rows={rows}
        cols={cols}
        aggregators={aggregators}
        aggregatorName={aggregateFunction}
        vals={['value']}
        rendererName={tableRenderer}
        colOrder={colOrder}
        rowOrder={rowOrder}
        sorters={{
          metric: sortAs(metricNames),
        }}
        tableOptions={{
          clickCallback: clickCellCallback,
          clickRowHeaderCallback,
          clickColumnHeaderCallback,
          colTotals,
          rowTotals,
        }}
        subtotalOptions={{
          colSubtotalDisplay: { displayOnTop: colSubtotalPosition },
          rowSubtotalDisplay: { displayOnTop: rowSubtotalPosition },
        }}
      />
    </Styles>
  );
}
