// DODO was here
import {
  ChartProps,
  DataRecord,
  extractTimegrain,
  GenericDataType,
  getTimeFormatter,
  // getTimeFormatterForGranularity, // DODO commented out 45525377
  QueryFormData,
  SMART_DATE_DOT_DDMMYYYY_ID, // DODO added 45525377
  SMART_DATE_ID,
  TimeFormats,
} from '@superset-ui/core';
import {
  extractDatasourceDescriptions, // DODO added 44728892
  getColorFormatters,
} from '@superset-ui/chart-controls';
import { DateFormatter } from '../types';
import { getPinnedColumnIndexes } from '../DodoExtensions/utils/getPinnedColumnIndexes'; // DODO added 45525377

const { DATABASE_DATETIME } = TimeFormats;

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(
    record =>
      record[key] === null ||
      record[key] === undefined ||
      typeof record[key] === 'number',
  );
}

export default function transformProps(chartProps: ChartProps<QueryFormData>) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your PivotTableChart.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    hooks: { setDataMask = () => {}, onContextMenu },
    filterState,
    datasource: {
      verboseMap = {},
      columnFormats = {},
      currencyFormats = {},
      metrics: datasourceMetrics = [], // DODO added 44728892
      columns: datasourceColumns = [], // DODO added 44728892
    },
    emitCrossFilters,
    locale, // DODO added 44728892
  } = chartProps;
  const { data, colnames, coltypes } = queriesData[0];
  const {
    groupbyRows,
    groupbyColumns,
    metrics,
    tableRenderer,
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
    dateFormat,
    metricsLayout,
    conditionalFormatting,
    timeGrainSqla,
    currencyFormat,
    columnConfig, // DODO added 45525377
  } = formData;
  const { selectedFilters } = filterState;
  const granularity = extractTimegrain(rawFormData);

  const dateFormatters = colnames
    .filter(
      (colname: string, index: number) =>
        coltypes[index] === GenericDataType.Temporal,
    )
    .reduce(
      (
        acc: Record<string, DateFormatter | undefined>,
        temporalColname: string,
      ) => {
        let formatter: DateFormatter | undefined;
        if (
          dateFormat === SMART_DATE_ID ||
          dateFormat === SMART_DATE_DOT_DDMMYYYY_ID // DODO added 45525377
        ) {
          if (granularity) {
            // time column use formats based on granularity
            // formatter = getTimeFormatterForGranularity(granularity);
            // DODO changed 45525377
            formatter = getTimeFormatter(dateFormat, granularity);
          } else if (isNumeric(temporalColname, data)) {
            formatter = getTimeFormatter(DATABASE_DATETIME);
          } else {
            // if no column-specific format, print cell as is
            formatter = String;
          }
        } else if (dateFormat) {
          formatter = getTimeFormatter(dateFormat);
        }
        if (formatter) {
          acc[temporalColname] = formatter;
        }
        return acc;
      },
      {},
    );
  const metricColorFormatters = getColorFormatters(conditionalFormatting, data);

  // DODO added 45525377
  const pinnedColumns = getPinnedColumnIndexes({
    columnConfig,
    combineMetric,
    groupbyColumns,
    groupbyRows,
    metricsLayout,
    transposePivot,
  });

  // DODO added 44728892
  const datasourceDescriptions = extractDatasourceDescriptions(
    [...metrics, ...groupbyRows, ...groupbyColumns],
    datasourceMetrics,
    datasourceColumns,
    locale,
  );

  return {
    width,
    height,
    data,
    groupbyRows,
    groupbyColumns,
    metrics,
    tableRenderer,
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
    datasourceMetrics, // DODO added 44211769
    columnConfig, // DODO added 45525377
    pinnedColumns, // DODO added 45525377
    datasourceDescriptions, // DODO added 44728892
  };
}
