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
import { useCallback, useMemo } from 'react';
import { MinusSquareOutlined, PlusSquareOutlined } from '@ant-design/icons';
import {
  AdhocMetric,
  BinaryQueryObjectFilterClause,
  CurrencyFormatter,
  DataRecordValue,
  FeatureFlag,
  getColumnLabel,
  getNumberFormatter,
  getSelectedText,
  isAdhocColumn,
  isFeatureEnabled,
  isPhysicalColumn,
  NumberFormatter,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { aggregatorTemplates, PivotTable, sortAs } from './react-pivottable';
import {
  FilterType,
  MetricsLayoutEnum,
  PivotTableProps,
  PivotTableStylesProps,
  SelectedFiltersType,
} from './types';

const Styles = styled.div<PivotTableStylesProps>`
  ${({ height, width, margin }) => `
      margin: ${margin}px;
      height: ${height - margin * 2}px;
      width: ${
        typeof width === 'string' ? parseInt(width, 10) : width - margin * 2
      }px;
 `}
`;

const PivotTableWrapper = styled.div`
  height: 100%;
  max-width: inherit;
  overflow: auto;
`;

const METRIC_KEY = t('Metric');
const vals = ['value'];

const StyledPlusSquareOutlined = styled(PlusSquareOutlined)`
  stroke: ${({ theme }) => theme.colors.grayscale.light2};
  stroke-width: 16px;
`;

const StyledMinusSquareOutlined = styled(MinusSquareOutlined)`
  stroke: ${({ theme }) => theme.colors.grayscale.light2};
  stroke-width: 16px;
`;

const aggregatorsFactory = (formatter: NumberFormatter) => ({
  Count: aggregatorTemplates.count(formatter),
  'Count Unique Values': aggregatorTemplates.countUnique(formatter),
  'List Unique Values': aggregatorTemplates.listUnique(', ', formatter),
  Sum: aggregatorTemplates.sum(formatter),
  Average: aggregatorTemplates.average(formatter),
  Median: aggregatorTemplates.median(formatter),
  'Sample Variance': aggregatorTemplates.var(1, formatter),
  'Sample Standard Deviation': aggregatorTemplates.stdev(1, formatter),
  Minimum: aggregatorTemplates.min(formatter),
  Maximum: aggregatorTemplates.max(formatter),
  First: aggregatorTemplates.first(formatter),
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

/* If you change this logic, please update the corresponding Python
 * function (https://github.com/apache/superset/blob/master/superset/charts/post_processing.py),
 * or reach out to @betodealmeida.
 */
export default function PivotTableChart(props: PivotTableProps) {
  const {
    data,
    height,
    width,
    groupbyRows: groupbyRowsRaw,
    groupbyColumns: groupbyColumnsRaw,
    metrics,
    colOrder,
    rowOrder,
    aggregateFunction,
    transposePivot,
    combineMetric,
    rowSubtotalPosition,
    colSubtotalPosition,
    colTotals,
    colSubTotals,
    rowTotals,
    rowSubTotals,
    valueFormat,
    currencyFormat,
    emitCrossFilters,
    setDataMask,
    selectedFilters,
    verboseMap,
    columnFormats,
    currencyFormats,
    metricsLayout,
    metricColorFormatters,
    dateFormatters,
    onContextMenu,
    timeGrainSqla,
  } = props;

  const theme = useTheme();
  const defaultFormatter = useMemo(
    () =>
      currencyFormat?.symbol
        ? new CurrencyFormatter({
            currency: currencyFormat,
            d3Format: valueFormat,
          })
        : getNumberFormatter(valueFormat),
    [valueFormat, currencyFormat],
  );
  const customFormatsArray = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(columnFormats || {}),
          ...Object.keys(currencyFormats || {}),
        ]),
      ).map(metricName => [
        metricName,
        columnFormats[metricName] || valueFormat,
        currencyFormats[metricName] || currencyFormat,
      ]),
    [columnFormats, currencyFormat, currencyFormats, valueFormat],
  );
  const hasCustomMetricFormatters = customFormatsArray.length > 0;
  const metricFormatters = useMemo(
    () =>
      hasCustomMetricFormatters
        ? {
            [METRIC_KEY]: Object.fromEntries(
              customFormatsArray.map(([metric, d3Format, currency]) => [
                metric,
                currency
                  ? new CurrencyFormatter({
                      currency,
                      d3Format,
                    })
                  : getNumberFormatter(d3Format),
              ]),
            ),
          }
        : undefined,
    [customFormatsArray, hasCustomMetricFormatters],
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
          ...metricNames
            .map((name: string) => ({
              ...record,
              [METRIC_KEY]: name,
              value: record[name],
            }))
            .filter(record => record.value !== null),
        ],
        [],
      ),
    [data, metricNames],
  );
  const groupbyRows = useMemo(
    () => groupbyRowsRaw.map(getColumnLabel),
    [groupbyRowsRaw],
  );
  const groupbyColumns = useMemo(
    () => groupbyColumnsRaw.map(getColumnLabel),
    [groupbyColumnsRaw],
  );

  const sorters = useMemo(
    () => ({
      [METRIC_KEY]: sortAs(metricNames),
    }),
    [metricNames],
  );

  const [rows, cols] = useMemo(() => {
    let [rows_, cols_] = transposePivot
      ? [groupbyColumns, groupbyRows]
      : [groupbyRows, groupbyColumns];

    if (metricsLayout === MetricsLayoutEnum.ROWS) {
      rows_ = combineMetric ? [...rows_, METRIC_KEY] : [METRIC_KEY, ...rows_];
    } else {
      cols_ = combineMetric ? [...cols_, METRIC_KEY] : [METRIC_KEY, ...cols_];
    }
    return [rows_, cols_];
  }, [
    combineMetric,
    groupbyColumns,
    groupbyRows,
    metricsLayout,
    transposePivot,
  ]);

  const handleChange = useCallback(
    (filters: SelectedFiltersType) => {
      const filterKeys = Object.keys(filters);
      const groupby = [...groupbyRowsRaw, ...groupbyColumnsRaw];
      setDataMask({
        extraFormData: {
          filters:
            filterKeys.length === 0
              ? undefined
              : filterKeys.map(key => {
                  const val = filters?.[key];
                  const col =
                    groupby.find(item => {
                      if (isPhysicalColumn(item)) {
                        return item === key;
                      }
                      if (isAdhocColumn(item)) {
                        return item.label === key;
                      }
                      return false;
                    }) ?? '';
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
          value:
            filters && Object.keys(filters).length
              ? Object.values(filters)
              : null,
          selectedFilters:
            filters && Object.keys(filters).length ? filters : null,
        },
      });
    },
    [groupbyColumnsRaw, groupbyRowsRaw, setDataMask],
  );

  const getCrossFilterDataMask = useCallback(
    (value: { [key: string]: string }) => {
      const isActiveFilterValue = (key: string, val: DataRecordValue) =>
        !!selectedFilters && selectedFilters[key]?.includes(val);

      if (!value) {
        return undefined;
      }

      const [key, val] = Object.entries(value)[0];
      let values = { ...selectedFilters };
      if (isActiveFilterValue(key, val)) {
        values = {};
      } else {
        values = { [key]: [val] };
      }

      const filterKeys = Object.keys(values);
      const groupby = [...groupbyRowsRaw, ...groupbyColumnsRaw];
      return {
        dataMask: {
          extraFormData: {
            filters:
              filterKeys.length === 0
                ? undefined
                : filterKeys.map(key => {
                    const val = values?.[key];
                    const col =
                      groupby.find(item => {
                        if (isPhysicalColumn(item)) {
                          return item === key;
                        }
                        if (isAdhocColumn(item)) {
                          return item.label === key;
                        }
                        return false;
                      }) ?? '';
                    if (val === null || val === undefined)
                      return {
                        col,
                        op: 'IS NULL' as const,
                      };
                    return {
                      col,
                      op: 'IN' as const,
                      val: val as (string | number | boolean)[],
                    };
                  }),
          },
          filterState: {
            value:
              values && Object.keys(values).length
                ? Object.values(values)
                : null,
            selectedFilters:
              values && Object.keys(values).length ? values : null,
          },
        },
        isCurrentValueSelected: isActiveFilterValue(key, val),
      };
    },
    [groupbyColumnsRaw, groupbyRowsRaw, selectedFilters],
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
      if (isSubtotal || isGrandTotal || !emitCrossFilters) {
        return;
      }

      // allow selecting text in a cell
      if (getSelectedText()) {
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
      if (
        Array.isArray(updatedFilters[key]) &&
        updatedFilters[key].length === 0
      ) {
        delete updatedFilters[key];
      }
      handleChange(updatedFilters);
    },
    [emitCrossFilters, selectedFilters, handleChange],
  );

  const tableOptions = useMemo(
    () => ({
      clickRowHeaderCallback: toggleFilter,
      clickColumnHeaderCallback: toggleFilter,
      colTotals,
      colSubTotals,
      rowTotals,
      rowSubTotals,
      highlightHeaderCellsOnHover:
        emitCrossFilters ||
        isFeatureEnabled(FeatureFlag.DrillBy) ||
        isFeatureEnabled(FeatureFlag.DrillToDetail),
      highlightedHeaderCells: selectedFilters,
      omittedHighlightHeaderGroups: [METRIC_KEY],
      cellColorFormatters: { [METRIC_KEY]: metricColorFormatters },
      dateFormatters,
    }),
    [
      colTotals,
      colSubTotals,
      dateFormatters,
      emitCrossFilters,
      metricColorFormatters,
      rowTotals,
      rowSubTotals,
      selectedFilters,
      toggleFilter,
    ],
  );

  const subtotalOptions = useMemo(
    () => ({
      colSubtotalDisplay: { displayOnTop: colSubtotalPosition },
      rowSubtotalDisplay: { displayOnTop: rowSubtotalPosition },
      arrowCollapsed: <StyledPlusSquareOutlined />,
      arrowExpanded: <StyledMinusSquareOutlined />,
    }),
    [colSubtotalPosition, rowSubtotalPosition],
  );

  const handleContextMenu = useCallback(
    (
      e: MouseEvent,
      colKey: (string | number | boolean)[] | undefined,
      rowKey: (string | number | boolean)[] | undefined,
      dataPoint: { [key: string]: string },
    ) => {
      if (onContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        if (colKey && colKey.length > 1) {
          colKey.forEach((val, i) => {
            const col = cols[i];
            const formatter = dateFormatters[col];
            const formattedVal = formatter?.(val as number) || String(val);
            if (i > 0) {
              drillToDetailFilters.push({
                col,
                op: '==',
                val,
                formattedVal,
                grain: formatter ? timeGrainSqla : undefined,
              });
            }
          });
        }
        if (rowKey) {
          rowKey.forEach((val, i) => {
            const col = rows[i];
            const formatter = dateFormatters[col];
            const formattedVal = formatter?.(val as number) || String(val);
            drillToDetailFilters.push({
              col,
              op: '==',
              val,
              formattedVal,
              grain: formatter ? timeGrainSqla : undefined,
            });
          });
        }
        onContextMenu(e.clientX, e.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: getCrossFilterDataMask(dataPoint),
          drillBy: dataPoint && {
            filters: [
              {
                col: Object.keys(dataPoint)[0],
                op: '==',
                val: Object.values(dataPoint)[0],
              },
            ],
            groupbyFieldName: rowKey ? 'groupbyRows' : 'groupbyColumns',
          },
        });
      }
    },
    [
      cols,
      dateFormatters,
      getCrossFilterDataMask,
      onContextMenu,
      rows,
      timeGrainSqla,
    ],
  );

  return (
    <Styles height={height} width={width} margin={theme.gridUnit * 4}>
      <PivotTableWrapper>
        <PivotTable
          data={unpivotedData}
          rows={rows}
          cols={cols}
          aggregatorsFactory={aggregatorsFactory}
          defaultFormatter={defaultFormatter}
          customFormatters={metricFormatters}
          aggregatorName={aggregateFunction}
          vals={vals}
          colOrder={colOrder}
          rowOrder={rowOrder}
          sorters={sorters}
          tableOptions={tableOptions}
          subtotalOptions={subtotalOptions}
          namesMapping={verboseMap}
          onContextMenu={handleContextMenu}
        />
      </PivotTableWrapper>
    </Styles>
  );
}
