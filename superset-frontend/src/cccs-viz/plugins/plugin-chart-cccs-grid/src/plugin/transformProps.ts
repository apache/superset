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
import { Column, getMetricLabel, Metric, QueryMode, t, TimeseriesDataRecord } from '@superset-ui/core';
import {
  CccsGridChartProps,
  CccsGridQueryFormData,
  DEFAULT_FORM_DATA,
} from '../types';

export default function transformProps(chartProps: CccsGridChartProps) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your CccsGrid.tsx file, but
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
    datasource,
    hooks,
    width,
    height,
    rawFormData: formData,
    queriesData,
  } = chartProps;
  const {
    boldText,
    headerFontSize,
    headerText,
    emitFilter,
    query_mode,
  }: CccsGridQueryFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const data = queriesData[0].data as TimeseriesDataRecord[];
  const agGridLicenseKey = queriesData[0].agGridLicenseKey as String;

  const { setDataMask = () => {} } = hooks;

  const columns = datasource?.columns as Column[];
  const metrics = datasource?.metrics as Metric[];

  // Map of column types, key is column name, value is column type
  const columnTypeMap = new Map<string, string>();
  columns.reduce(function (columnMap, column: Column) {
    // @ts-ignore
    const name = column['column_name'];
    // @ts-ignore
    columnMap[name] = column.type;
    return columnMap;
  }, columnTypeMap);

  // Map of verbose names, key is column name, value is verbose name
  const columnVerboseNameMap = new Map<string, string>();
  columns.reduce(function (columnMap, column: Column) {
    // @ts-ignore
    const name = column['column_name'];
    // @ts-ignore
    columnMap[name] = column.verbose_name;
    return columnMap;
  }, columnVerboseNameMap);

  // Map of verbose names, key is metric name, value is verbose name
  const metricVerboseNameMap = new Map<string, string>();
  metrics.reduce(function (metricMap, metric: Metric) {
    // @ts-ignore
    const name = metric['metric_name'];
    // @ts-ignore
    metricMap[name] = metric.verbose_name;
    return metricMap;
  }, metricVerboseNameMap);

  // Map of sorting columns, key is column name, value is a struct of sort direction (asc/desc) and sort index
  const sortingColumnMap = new Map<string, {}>();
  formData.order_by_cols.reduce(function (
    columnMap: { [x: string]: any },
    item: string,
    currentIndex: number,
  ) {
    // Logic from extractQueryFields.ts
    if (typeof item === 'string') {
      try {
        const array = JSON.parse(item);
        const name = array[0];
        const sortDirection = array[1];
        const sortIndex = currentIndex - 1;
        const sortOptions = {
          sortDirection: sortDirection,
          sortIndex: sortIndex,
        };
        columnMap[name] = sortOptions;
      } catch (error) {
        throw new Error(t('Found invalid orderby option: %s', item));
      }
      return columnMap;
    } else {
      console.log('Found invalid orderby option: %s.', item);
      return undefined;
    }
  },
  sortingColumnMap);

  // Key is column type, value is renderer name
  const rendererMap = {
    IPV4: 'ipv4ValueRenderer',
    IPV6: 'ipv6ValueRenderer',
    DOMAIN: 'domainValueRenderer',
    COUNTRY: 'countryValueRenderer',
    JSON: 'jsonValueRenderer',
  };

  var columnDefs: Column[] = [];

  if (query_mode === QueryMode.raw) {
    columnDefs = formData.columns.map((column: any) => {
      const columnType = columnTypeMap[column];
      const columnHeader = columnVerboseNameMap[column]
        ? columnVerboseNameMap[column]
        : column;
      const sortDirection =
        column in sortingColumnMap
          ? sortingColumnMap[column].sortDirection
            ? 'asc'
            : 'desc'
          : null;
      const sortIndex =
        column in sortingColumnMap ? sortingColumnMap[column].sortIndex : null;
      const cellRenderer =
        columnType in rendererMap ? rendererMap[columnType] : undefined;
      const isSortable = true;
      return {
        field: column,
        headerName: columnHeader,
        cellRenderer: cellRenderer,
        sortable: isSortable,
        sort: sortDirection,
        sortIndex: sortIndex,
      };
    });
  } else {
    if (formData.groupby) {
      const groupByColumnDefs = formData.groupby.map((column: any) => {
        const columnType = columnTypeMap[column];
        const columnHeader = columnVerboseNameMap[column]
          ? columnVerboseNameMap[column]
          : column;
        const cellRenderer =
          columnType in rendererMap ? rendererMap[columnType] : undefined;
        const isSortable = true;
        return {
          field: column,
          headerName: columnHeader,
          cellRenderer: cellRenderer,
          sortable: isSortable,
        };
      });
      columnDefs = columnDefs.concat(groupByColumnDefs);
    }

    if (formData.metrics) {
      const metricsColumnDefs = formData.metrics
        .map(getMetricLabel)
        .map((metric: any) => {
        const metricHeader = metricVerboseNameMap[metric]
          ? metricVerboseNameMap[metric]
          : metric;
        return {
          field: metric,
          headerName: metricHeader,
          sortable: true,
        };
      });
      columnDefs = columnDefs.concat(metricsColumnDefs);
    }
  }

  return {
    formData,
    setDataMask,
    width,
    height,
    columnDefs: columnDefs,
    rowData: data,
    // and now your control data, manipulated as needed, and passed through as props!
    boldText,
    headerFontSize,
    headerText,
    emitFilter,
    agGridLicenseKey,
  };
}
