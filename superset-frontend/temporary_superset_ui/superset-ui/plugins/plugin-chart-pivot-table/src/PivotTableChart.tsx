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
import React, { useCallback, useMemo } from 'react';
import { PlusSquareOutlined, MinusSquareOutlined } from '@ant-design/icons';
import {
  styled,
  AdhocMetric,
  getNumberFormatter,
  DataRecordValue,
  NumberFormatter,
} from '@superset-ui/core';
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
const iconStyle = { stroke: 'black', strokeWidth: '16px' };

const aggregatorsFactory = (formatter: NumberFormatter) => ({
  Count: aggregatorTemplates.count(formatter),
  'Count Unique Values': aggregatorTemplates.countUnique(formatter),
  'List Unique Values': aggregatorTemplates.listUnique(', '),
  Sum: aggregatorTemplates.sum(formatter),
  Average: aggregatorTemplates.average(formatter),
  Median: aggregatorTemplates.median(formatter),
  'Sample Variance': aggregatorTemplates.var(1, formatter),
  'Sample Standard Deviation': aggregatorTemplates.stdev(1, formatter),
  Minimum: aggregatorTemplates.min(formatter),
  Maximum: aggregatorTemplates.max(formatter),
  First: aggregatorTemplates.first(),
  Last: aggregatorTemplates.last(formatter),
  'Sum as Fraction of Total': aggregatorTemplates.fractionOf(
    aggregatorTemplates.sum(),
    'total',
    formatter,
  ),
  'Sum as Fraction of Rows': aggregatorTemplates.fractionOf(
    aggregatorTemplates.sum(),
    'row',
    formatter,
  ),
  'Sum as Fraction of Columns': aggregatorTemplates.fractionOf(
    aggregatorTemplates.sum(),
    'col',
    formatter,
  ),
  'Count as Fraction of Total': aggregatorTemplates.fractionOf(
    aggregatorTemplates.count(),
    'total',
    formatter,
  ),
  'Count as Fraction of Rows': aggregatorTemplates.fractionOf(
    aggregatorTemplates.count(),
    'row',
    formatter,
  ),
  'Count as Fraction of Columns': aggregatorTemplates.fractionOf(
    aggregatorTemplates.count(),
    'col',
    formatter,
  ),
});

export default function PivotTableChart(props: PivotTableProps) {
  const {
    data,
    height,
    width,
    groupbyRows,
    groupbyColumns,
    metrics,
    colOrder,
    rowOrder,
    aggregateFunction,
    transposePivot,
    combineMetric,
    rowSubtotalPosition,
    colSubtotalPosition,
    colTotals,
    rowTotals,
    valueFormat,
    emitFilter,
    setDataMask,
    selectedFilters,
    verboseMap,
    columnFormats,
    metricsLayout,
    metricColorFormatters,
    dateFormatters,
  } = props;

  const defaultFormatter = getNumberFormatter(valueFormat);
  const columnFormatsArray = Object.entries(columnFormats);
  const hasCustomMetricFormatters = columnFormatsArray.length > 0;
  const metricFormatters =
    hasCustomMetricFormatters &&
    Object.fromEntries(
      columnFormatsArray.map(([metric, format]) => [metric, getNumberFormatter(format)]),
    );

  const metricNames = useMemo(
    () =>
      metrics.map((metric: string | AdhocMetric) =>
        typeof metric === 'string' ? metric : (metric.label as string),
      ),
    [metrics],
  );

  const unpivotedData = useMemo(
    () =>
      data.reduce(
        (acc: Record<string, any>[], record: Record<string, any>) => [
          ...acc,
          ...metricNames.map((name: string) => ({
            ...record,
            [METRIC_KEY]: name,
            value: record[name],
          })),
        ],
        [],
      ),
    [data, metricNames],
  );

  let [rows, cols] = transposePivot ? [groupbyColumns, groupbyRows] : [groupbyRows, groupbyColumns];

  if (metricsLayout === MetricsLayoutEnum.ROWS) {
    rows = combineMetric ? [...rows, METRIC_KEY] : [METRIC_KEY, ...rows];
  } else {
    cols = combineMetric ? [...cols, METRIC_KEY] : [METRIC_KEY, ...cols];
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

      const isActiveFilterValue = (key: string, val: DataRecordValue) =>
        !!selectedFilters && selectedFilters[key]?.includes(val);

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
        aggregatorsFactory={aggregatorsFactory}
        defaultFormatter={defaultFormatter}
        customFormatters={
          hasCustomMetricFormatters ? { [METRIC_KEY]: metricFormatters } : undefined
        }
        aggregatorName={aggregateFunction}
        vals={['value']}
        rendererName="Table With Subtotal"
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
          cellColorFormatters: { [METRIC_KEY]: metricColorFormatters },
          dateFormatters,
        }}
        subtotalOptions={{
          colSubtotalDisplay: { displayOnTop: colSubtotalPosition },
          rowSubtotalDisplay: { displayOnTop: rowSubtotalPosition },
          arrowCollapsed: <PlusSquareOutlined style={iconStyle} />,
          arrowExpanded: <MinusSquareOutlined style={iconStyle} />,
        }}
        namesMapping={verboseMap}
      />
    </Styles>
  );
}
