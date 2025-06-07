import { Behavior, t } from '@superset-ui/core';
import transformProps from './transformProps';
import controlPanel from './controlPanel';
import buildQuery from './buildQuery';
import { EchartsChartPlugin } from '../types';
import thumbnail from './images/thumbnail.png';
import example1 from './images/example1.png';
import example2 from './images/example2.png';

export default class EchartsTimelineChartPlugin extends EchartsChartPlugin {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsTimeline'),
      metadata: {
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
        ],
        credits: ['https://echarts.apache.org'],
        name: t('Timeline'),
        description: t(
          'Timeline chart visualizes important events over a time span. ' +
            'Every data point displayed as a separate event along a ' +
            'horizontal line.',
        ),
        tags: [t('ECharts'), t('Time'), t('Featured')],
        thumbnail,
        exampleGallery: [{ url: example1 }, { url: example2 }],
      },
      transformProps,
    });
  }
}
