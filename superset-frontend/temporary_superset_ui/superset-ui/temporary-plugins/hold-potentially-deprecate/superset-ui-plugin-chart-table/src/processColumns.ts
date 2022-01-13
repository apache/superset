/*
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

import {
  getTimeFormatter,
  TimeFormatter,
  getNumberFormatter,
  NumberFormats,
  NumberFormatter,
  DTTM_ALIAS,
} from '@superset-ui/core';
import { createSelector } from 'reselect';
import { PlainObject } from './types';

type inputType = {
  columns: string[];
  metrics: string[];
  records: any[];
  tableTimestampFormat: string;
  datasource: PlainObject;
};

function processColumns(
  columns: string[],
  metrics: string[],
  records: any[],
  tableTimestampFormat: string,
  datasource: PlainObject,
) {
  const { columnFormats, verboseMap } = datasource;

  const dataArray: {
    [key: string]: any[];
  } = {};

  metrics.forEach(metric => {
    const arr: any[] = [];
    records.forEach(record => {
      arr.push(record[metric]);
    });

    dataArray[metric] = arr;
  });

  const maxes: {
    [key: string]: number;
  } = {};
  const mins: {
    [key: string]: number;
  } = {};

  metrics.forEach(metric => {
    maxes[metric] = Math.max(...dataArray[metric]);
    mins[metric] = Math.min(...dataArray[metric]);
  });

  const formatPercent = getNumberFormatter(NumberFormats.PERCENT_3_POINT);
  const tsFormatter = getTimeFormatter(tableTimestampFormat);

  const processedColumns = columns.map((key: string) => {
    let label = verboseMap[key];
    const formatString = columnFormats?.[key];
    let formatFunction: NumberFormatter | TimeFormatter | undefined;
    let type: 'string' | 'metric' = 'string';

    if (key === DTTM_ALIAS) {
      formatFunction = tsFormatter;
    }

    const extraField: {
      [key: string]: any;
    } = {};

    if (metrics.includes(key)) {
      formatFunction = getNumberFormatter(formatString);
      type = 'metric';
      extraField.maxValue = maxes[key];
      extraField.minValue = mins[key];
    }

    // Handle verbose names for percents
    if (!label) {
      if (key.length > 0 && key[0] === '%') {
        const cleanedKey = key.slice(1);
        label = `% ${verboseMap[cleanedKey] || cleanedKey}`;
        formatFunction = formatPercent;
      } else {
        label = key;
      }
    }

    return {
      format: formatFunction,
      key,
      label,
      type,
      ...extraField,
    };
  });

  return processedColumns;
}

const getCreateSelectorFunction = () =>
  createSelector(
    (data: inputType) => data.columns,
    data => data.metrics,
    data => data.records,
    data => data.tableTimestampFormat,
    data => data.datasource,
    (columns, metrics, records, tableTimestampFormat, datasource) =>
      processColumns(
        columns,
        metrics,
        records,
        tableTimestampFormat,
        datasource,
      ),
  );

export default getCreateSelectorFunction;
