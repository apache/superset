import { buildQueryContext } from '@superset-ui/chart';
import ChartFormData from './ChartFormData';

export default function buildQuery(formData: ChartFormData) {
  const queryContext = buildQueryContext(formData);

  // Enforce time-series mode
  queryContext.queries.forEach(query => {
    const q = query;
    q.is_timeseries = true;
  });

  return queryContext;
}
