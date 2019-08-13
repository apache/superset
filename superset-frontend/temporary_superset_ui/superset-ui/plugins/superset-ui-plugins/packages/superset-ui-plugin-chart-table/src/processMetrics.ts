import { ChartFormDataMetric, AdhocMetric } from '@superset-ui/chart';
import { PlainObject } from './types';

export default function processMetrics({
  metrics,
  percentMetrics,
  records,
}: {
  metrics: ChartFormDataMetric[];
  percentMetrics: ChartFormDataMetric[];
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
