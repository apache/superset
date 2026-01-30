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
import { t } from '@apache-superset/core';
import {
  AdhocMetric,
  BinaryQueryObjectFilterClause,
  Currency,
  CurrencyFormatter,
  DataRecordValue,
  FeatureFlag,
  getColumnLabel,
  getNumberFormatter,
  getSelectedText,
  hasMixedCurrencies,
  isAdhocColumn,
  isFeatureEnabled,
  isPhysicalColumn,
  normalizeCurrency,
  NumberFormatter,
} from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
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
  ${({ theme }) => `
    height: 100%;
    max-width: inherit;
    overflow: auto;

    /* Chrome/Safari/Edge webkit scrollbar styling */
    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: ${theme.colorFillQuaternary};
    }

    &::-webkit-scrollbar-thumb {
      background: ${theme.colorFillSecondary};
      border-radius: ${theme.borderRadiusSM}px;

      &:hover {
        background: ${theme.colorFillTertiary};
      }
    }

    &::-webkit-scrollbar-corner {
      background: ${theme.colorFillQuaternary};
    }

    /* Firefox scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: ${theme.colorFillSecondary} ${theme.colorFillQuaternary};
  `}
`;

const METRIC_KEY = t('Metric');
const vals = ['value'];

const StyledPlusSquareOutlined = styled(PlusSquareOutlined)`
  stroke: ${({ theme }) => theme.colorBorderSecondary};
  stroke-width: 16px;
`;

const StyledMinusSquareOutlined = styled(MinusSquareOutlined)`
  stroke: ${({ theme }) => theme.colorBorderSecondary};
  stroke-width: 16px;
`;

/** Aggregator with currency tracking support */
interface CurrencyTrackingAggregator {
  getCurrencies?: () => string[];
}

type BaseFormatter = NumberFormatter | CurrencyFormatter;

/** Create formatter that handles AUTO mode with per-cell currency detection */
const createCurrencyAwareFormatter = (
  baseFormatter: BaseFormatter,
  currencyConfig: Currency | undefined,
  d3Format: string,
  fallbackCurrency?: string,
): ((value: number, aggregator?: CurrencyTrackingAggregator) => string) => {
  const isAutoMode = currencyConfig?.symbol === 'AUTO';

  return (value: number, aggregator?: CurrencyTrackingAggregator): string => {
    // If not AUTO mode, use base formatter directly
    if (!isAutoMode) {
      return baseFormatter(value);
    }

    // AUTO mode: check aggregator for currency tracking
    if (aggregator && typeof aggregator.getCurrencies === 'function') {
      const currencies = aggregator.getCurrencies();

      if (currencies && currencies.length > 0) {
        if (hasMixedCurrencies(currencies)) {
          return getNumberFormatter(d3Format)(value);
        }

        const detectedCurrency = normalizeCurrency(currencies[0]);
        if (detectedCurrency && currencyConfig) {
          const cellFormatter = new CurrencyFormatter({
            currency: {
              symbol: detectedCurrency,
              symbolPosition: currencyConfig.symbolPosition,
            },
            d3Format,
          });
          return cellFormatter(value);
        }
      }
    }

    // Fallback: use detected_currency from API response if available
    if (fallbackCurrency && currencyConfig) {
      const normalizedFallback = normalizeCurrency(fallbackCurrency);
      if (normalizedFallback) {
        const fallbackFormatter = new CurrencyFormatter({
          currency: {
            symbol: normalizedFallback,
            symbolPosition: currencyConfig.symbolPosition,
          },
          d3Format,
        });
        return fallbackFormatter(value);
      }
    }

    // Final fallback to neutral format
    return getNumberFormatter(d3Format)(value);
  };
};

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
    currencyCodeColumn,
    detectedCurrency,
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
    allowRenderHtml,
    defaultRowExpansionDepth = 0,
    defaultColExpansionDepth = 0,
  } = props;

  const theme = useTheme();

  // Base formatter without currency-awareness (for non-AUTO mode or as fallback)
  const baseFormatter = useMemo(
    () =>
      currencyFormat?.symbol && currencyFormat.symbol !== 'AUTO'
        ? new CurrencyFormatter({
            currency: currencyFormat,
            d3Format: valueFormat,
          })
        : getNumberFormatter(valueFormat),
    [valueFormat, currencyFormat],
  );

  // Currency-aware formatter for AUTO mode support
  const defaultFormatter = useMemo(
    () =>
      createCurrencyAwareFormatter(
        baseFormatter,
        currencyFormat,
        valueFormat,
        detectedCurrency ?? undefined,
      ),
    [baseFormatter, currencyFormat, valueFormat, detectedCurrency],
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
              customFormatsArray.map(([metric, d3Format, currency]) => {
                // Create base formatter
                const metricBaseFormatter =
                  currency && (currency as Currency).symbol !== 'AUTO'
                    ? new CurrencyFormatter({
                        currency: currency as Currency,
                        d3Format: d3Format as string,
                      })
                    : getNumberFormatter(d3Format as string);

                // Wrap with currency-aware formatter for AUTO mode support
                return [
                  metric,
                  createCurrencyAwareFormatter(
                    metricBaseFormatter,
                    currency as Currency | undefined,
                    d3Format as string,
                    detectedCurrency ?? undefined,
                  ),
                ];
              }),
            ),
          }
        : undefined,
    [customFormatsArray, hasCustomMetricFormatters, detectedCurrency],
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
              // Mark currency column for per-cell currency detection in aggregators
              __currencyColumn: currencyCodeColumn,
            }))
            .filter(record => record.value !== null),
        ],
        [],
      ),
    [data, metricNames, currencyCodeColumn],
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

      let updatedFilters = { ...selectedFilters };
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
    <Styles height={height} width={width} margin={theme.sizeUnit * 4}>
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
          allowRenderHtml={allowRenderHtml}
          defaultRowExpansionDepth={defaultRowExpansionDepth}
          defaultColExpansionDepth={defaultColExpansionDepth}
        />
      </PivotTableWrapper>
    </Styles>
  );
}
