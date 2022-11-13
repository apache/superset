import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import thumbnail from './images/thumbnail.png';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';

export default class EchartsBubbleChartPlugin extends ChartPlugin<
  EchartsBubbleFormData,
  EchartsBubbleChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsBubble'),
      metadata: new ChartMetadata({
        behaviors: [Behavior.INTERACTIVE_CHART],
        category: t('Correlation'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.',
        ),
        name: t('Bubble Chart V2'),
        tags: [
          t('Multi-Dimensions'),
          t('Aesthetic'),
          t('Comparison'),
          t('Scatter'),
          t('Time'),
          t('Trend'),
          t('ECharts'),
        ],
        thumbnail,
      }),
      transformProps,
    });
  }
}
