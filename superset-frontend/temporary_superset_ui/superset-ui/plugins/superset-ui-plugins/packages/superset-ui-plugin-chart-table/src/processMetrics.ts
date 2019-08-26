import { QueryFormDataMetric, AdhocMetric } from '@superset-ui/query';
import { PlainObject } from './types';

export default function processMetrics({
  metrics,
  percentMetrics,
  records,
}: {
  metrics: QueryFormDataMetric[];
  percentMetrics: QueryFormDataMetric[];
  records: PlainObject[];
}) {
  const processedMetrics = (metrics || []).map(m => (m as AdhocMetric).label || (m as string));

  const processedPercentMetrics = (percentMetrics || [])
    .map(m => (m as AdhocMetric).label || (m as string))
    .map(m => `%${m}`);

  return processedMetrics
    .concat(processedPercentMetrics)
    .filter(m => typeof records[0][m] === 'number');
}
