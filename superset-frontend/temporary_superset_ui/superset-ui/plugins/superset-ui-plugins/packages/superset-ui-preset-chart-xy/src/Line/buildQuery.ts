import { buildQueryContext } from '@superset-ui/chart';
import ChartFormData from './ChartFormData';

export default function buildQuery(formData: ChartFormData) {
  return buildQueryContext(formData);
}
