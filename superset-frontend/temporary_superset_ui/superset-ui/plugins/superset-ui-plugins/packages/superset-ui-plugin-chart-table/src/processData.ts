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

  let processedRecords = records;

  if (sortByKey) {
    processedRecords = records
      .slice()
      .sort(
        orderDesc ? (a, b) => b[sortByKey] - a[sortByKey] : (a, b) => a[sortByKey] - b[sortByKey],
      );
  }

  return processedRecords.map(
    sortByKey && metrics.indexOf(sortByKey) < 0
      ? row => {
          const data = { ...row };
          delete data[sortByKey];

          return { data };
        }
      : row => ({ data: row }),
  );
}
