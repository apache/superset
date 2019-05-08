import { ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import createMetadata from '../createMetadata';
import Chart from '../Line';

export default class LineChartPlugin extends ChartPlugin {
  constructor() {
    super({
      Chart,
      metadata: createMetadata(true),
      transformProps,
    });
  }
}
