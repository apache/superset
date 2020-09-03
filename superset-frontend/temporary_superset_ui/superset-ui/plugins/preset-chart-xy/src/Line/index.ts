import { ChartPlugin } from '@superset-ui/core';
import transformProps from './transformProps';
import createMetadata from './createMetadata';
import buildQuery from './buildQuery';
import ChartFormData from './ChartFormData';

export default class LineChartPlugin extends ChartPlugin<ChartFormData> {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('../components/Line/Line'),
      metadata: createMetadata(),
      transformProps,
    });
  }
}
