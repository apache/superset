import { ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import createMetadata from './createMetadata';
import buildQuery from './buildQuery';
import ChartFormData from './ChartFormData';
import Chart from './Line';

export default class LineChartPlugin extends ChartPlugin<ChartFormData> {
  constructor() {
    super({
      buildQuery,
      Chart,
      metadata: createMetadata(),
      transformProps,
    });
  }
}
