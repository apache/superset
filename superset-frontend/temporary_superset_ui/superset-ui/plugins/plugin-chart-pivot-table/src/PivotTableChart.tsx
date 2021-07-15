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
import React, { useCallback } from 'react';
import { styled, AdhocMetric, getNumberFormatter, DataRecordValue } from '@superset-ui/core';
// @ts-ignore
import PivotTable from '@superset-ui/react-pivottable/PivotTable';
// @ts-ignore
import { sortAs, aggregatorTemplates } from '@superset-ui/react-pivottable/Utilities';
import '@superset-ui/react-pivottable/pivottable.css';
import {
  FilterType,
  MetricsLayoutEnum,
  PivotTableProps,
  PivotTableStylesProps,
  SelectedFiltersType,
} from './types';

const Styles = styled.div<PivotTableStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow-y: scroll;
  }
`;

const METRIC_KEY = 'metric';

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
    emitFilter,
    setDataMask,
    selectedFilters,
    verboseMap,
    metricsLayout,
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
        [METRIC_KEY]: name,
        value: record[name],
      })),
    ],
    [],
  );

  let [rows, cols] = transposePivot ? [groupbyColumns, groupbyRows] : [groupbyRows, groupbyColumns];

  if (metricsLayout === MetricsLayoutEnum.ROWS) {
    rows = [METRIC_KEY, ...rows];
  } else {
    cols = [METRIC_KEY, ...cols];
  }

  const handleChange = useCallback(
    (filters: SelectedFiltersType) => {
      const groupBy = Object.keys(filters);
      setDataMask({
        extraFormData: {
          filters:
            groupBy.length === 0
              ? undefined
              : groupBy.map(col => {
                  const val = filters?.[col];
                  if (val === null || val === undefined)
                    return {
                      col,
                      op: 'IS NULL',
                    };
                  return {
                    col,
                    op: 'IN',
                    val: val as (string | number | boolean)[],
                  };
                }),
        },
        filterState: {
          value: filters && Object.keys(filters).length ? Object.values(filters) : null,
          selectedFilters: filters && Object.keys(filters).length ? filters : null,
        },
      });
    },
    [setDataMask],
  );

  const isActiveFilterValue = useCallback(
    (key: string, val: DataRecordValue) => !!selectedFilters && selectedFilters[key]?.includes(val),
    [selectedFilters],
  );

  const toggleFilter = useCallback(
    (
      e: MouseEvent,
      value: string,
      filters: FilterType,
      pivotData: Record<string, any>,
      isSubtotal: boolean,
      isGrandTotal: boolean,
    ) => {
      if (isSubtotal || isGrandTotal || !emitFilter) {
        return;
      }

      const filtersCopy = { ...filters };
      delete filtersCopy[METRIC_KEY];

      const filtersEntries = Object.entries(filtersCopy);
      if (filtersEntries.length === 0) {
        return;
      }

      const [key, val] = filtersEntries[filtersEntries.length - 1];

      let updatedFilters = { ...(selectedFilters || {}) };
      // multi select
      // if (selectedFilters && isActiveFilterValue(key, val)) {
      //   updatedFilters[key] = selectedFilters[key].filter((x: DataRecordValue) => x !== val);
      // } else {
      //   updatedFilters[key] = [...(selectedFilters?.[key] || []), val];
      // }
      // single select
      if (selectedFilters && isActiveFilterValue(key, val)) {
        updatedFilters = {};
      } else {
        updatedFilters = {
          [key]: [val],
        };
      }
      if (Array.isArray(updatedFilters[key]) && updatedFilters[key].length === 0) {
        delete updatedFilters[key];
      }
      handleChange(updatedFilters);
    },
    [emitFilter, selectedFilters, handleChange],
  );

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
          clickRowHeaderCallback: toggleFilter,
          clickColumnHeaderCallback: toggleFilter,
          colTotals,
          rowTotals,
          highlightHeaderCellsOnHover: emitFilter,
          highlightedHeaderCells: selectedFilters,
          omittedHighlightHeaderGroups: [METRIC_KEY],
        }}
        subtotalOptions={{
          colSubtotalDisplay: { displayOnTop: colSubtotalPosition },
          rowSubtotalDisplay: { displayOnTop: rowSubtotalPosition },
        }}
        namesMapping={verboseMap}
      />
    </Styles>
  );
}
