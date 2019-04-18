import { ChartPlugin } from '@superset-ui/chart';
import metadata from './metadata';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import ChartFormData from './ChartFormData';

export default class LineChartPlugin extends ChartPlugin<ChartFormData> {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('./Line'),
      metadata,
      transformProps,
    });
  }
}
