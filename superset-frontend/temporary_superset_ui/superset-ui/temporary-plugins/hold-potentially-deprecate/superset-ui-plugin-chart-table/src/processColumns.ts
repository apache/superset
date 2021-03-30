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
      processColumns(columns, metrics, records, tableTimestampFormat, datasource),
  );

export default getCreateSelectorFunction;
