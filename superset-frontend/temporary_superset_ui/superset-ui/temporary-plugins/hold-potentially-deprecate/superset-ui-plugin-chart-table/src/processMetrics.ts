import { QueryFormMetric, AdhocMetric } from '@superset-ui/core';
import { createSelector } from 'reselect';
import { PlainObject } from './types';

type inputType = {
  metrics: QueryFormMetric[];
  percentMetrics: QueryFormMetric[];
  records: PlainObject[];
};

function processMetrics(
  metrics: QueryFormMetric[],
  percentMetrics: QueryFormMetric[],
  records: PlainObject[],
) {
  const processedMetrics = (metrics || []).map(m => (m as AdhocMetric).label ?? (m as string));

  const processedPercentMetrics = (percentMetrics || [])
    .map(m => (m as AdhocMetric).label ?? (m as string))
    .map(m => `%${m}`);

  return processedMetrics
    .concat(processedPercentMetrics)
    .filter(m => typeof records[0][m] === 'number');
}

const getCreateSelectorFunction = () =>
  createSelector(
    (data: inputType) => data.metrics,
    data => data.percentMetrics,
    data => data.records,
    (metrics, percentMetrics, records) => processMetrics(metrics, percentMetrics, records),
  );

export default getCreateSelectorFunction;
