import { ChartPlugin } from '@superset-ui/chart';
import metadata from './metadata';
import transformProps from './transformProps';

export default class LineChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('../Line'),
      metadata,
      transformProps,
    });
  }
}
