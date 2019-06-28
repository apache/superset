import { ChartFormDataMetric, AdhocMetric } from '@superset-ui/chart';
import { PlainObject } from './types';

export default function processData({
  timeseriesLimitMetric,
  orderDesc,
  records,
  metrics,
}: {
  timeseriesLimitMetric: ChartFormDataMetric;
  orderDesc: boolean;
  records: PlainObject[];
  metrics: string[];
}) {
  const sortByKey =
    timeseriesLimitMetric &&
    ((timeseriesLimitMetric as AdhocMetric).label || (timeseriesLimitMetric as string));

  let processedData: {
    data: PlainObject;
  }[] = records.map((row: PlainObject) => ({
    data: row,
  }));

  if (sortByKey) {
    processedData = processedData.sort((a, b) => {
      const delta = a.data[sortByKey] - b.data[sortByKey];
      if (orderDesc) {
        return -delta;
      }

      return delta;
    });
    if (metrics.indexOf(sortByKey) < 0) {
      processedData = processedData.map(row => {
        const data = { ...row.data };
        delete data[sortByKey];

        return {
          data,
        };
      });
    }
  }

  return processedData;
}
