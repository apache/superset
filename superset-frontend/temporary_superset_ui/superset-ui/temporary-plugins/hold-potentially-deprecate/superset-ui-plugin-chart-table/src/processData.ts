import { QueryFormMetric, AdhocMetric } from '@superset-ui/core';
import { createSelector } from 'reselect';
import { PlainObject } from './types';

type inputType = {
  timeseriesLimitMetric: QueryFormMetric;
  orderDesc: boolean;
  records: PlainObject[];
  metrics: string[];
};

function processData(
  timeseriesLimitMetric: QueryFormMetric,
  orderDesc: boolean,
  records: PlainObject[],
  metrics: string[],
) {
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
    sortByKey && !metrics.includes(sortByKey)
      ? row => {
          const data = { ...row };
          delete data[sortByKey];

          return { data };
        }
      : row => ({ data: row }),
  );
}

const getCreateSelectorFunction = () =>
  createSelector(
    (data: inputType) => data.timeseriesLimitMetric,
    data => data.orderDesc,
    data => data.records,
    data => data.metrics,
    (timeseriesLimitMetric, orderDesc, records, metrics) =>
      processData(timeseriesLimitMetric, orderDesc, records, metrics),
  );

export default getCreateSelectorFunction;
