import { ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import createMetadata from '../createMetadata';

export default class LineChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('../../components/Line/Line'),
      metadata: createMetadata(true),
      transformProps,
    });
  }
}
