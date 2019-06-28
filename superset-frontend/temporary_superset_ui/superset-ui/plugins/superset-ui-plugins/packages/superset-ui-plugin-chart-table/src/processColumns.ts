import { getNumberFormatter, NumberFormats, NumberFormatter } from '@superset-ui/number-format';
import { getTimeFormatter, TimeFormatter } from '@superset-ui/time-format';
import { PlainObject } from './types';

const DTTM_ALIAS = '__timestamp';

export default function processColumns({
  columns,
  metrics,
  records,
  tableTimestampFormat,
  datasource,
}: {
  columns: string[];
  metrics: string[];
  records: any[];
  tableTimestampFormat: string;
  datasource: PlainObject;
}) {
  const { columnFormats, verboseMap } = datasource;

  const dataArray: {
    [key: string]: any[];
  } = {};

  metrics.forEach(metric => {
    const arr = [];
    for (let i = 0; i < records.length; i += 1) {
      arr.push(records[i][metric]);
    }

    dataArray[metric] = arr;
  });

  const maxes: {
    [key: string]: number;
  } = {};
  const mins: {
    [key: string]: number;
  } = {};

  for (let i = 0; i < metrics.length; i += 1) {
    maxes[metrics[i]] = Math.max(...dataArray[metrics[i]]);
    mins[metrics[i]] = Math.min(...dataArray[metrics[i]]);
  }

  const formatPercent = getNumberFormatter(NumberFormats.PERCENT_3_POINT);
  const tsFormatter = getTimeFormatter(tableTimestampFormat);

  const processedColumns = columns.map((key: string) => {
    let label = verboseMap[key];
    const formatString = columnFormats && columnFormats[key];
    let formatFunction: NumberFormatter | TimeFormatter | undefined;
    let type = 'string';

    if (key === DTTM_ALIAS) {
      formatFunction = tsFormatter;
    }

    const extraField: {
      [key: string]: any;
    } = {};

    if (metrics.indexOf(key) >= 0) {
      formatFunction = getNumberFormatter(formatString);
      type = 'metric';
      extraField.maxValue = maxes[key];
      extraField.minValue = mins[key];
    }

    // Handle verbose names for percents
    if (!label) {
      if (key[0] === '%') {
        const cleanedKey = key.substring(1);
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
