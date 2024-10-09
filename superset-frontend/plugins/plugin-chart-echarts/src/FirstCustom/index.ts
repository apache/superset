import { Behavior, t } from '@superset-ui/core';
import buildQuery from './buildQuery';
import transformProps from './transformProps';
import controlPanel from './controlPanel';
import thumbnail from './images/chiro.png'
import img1 from './images/aspi.png'
import { EchartsChartPlugin } from '../types'
import { CustomChartFormData, CustomChartProps } from './types';

export default class CustomChartPlugin extends EchartsChartPlugin<
  CustomChartFormData,
  CustomChartProps
> {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('./CustomChart'),
      transformProps,
      controlPanel,
      metadata: {
        behaviors: [
          Behavior.DrillBy
        ],
        category: t('!In Development'),
        credits: ['ME'],
        description: t('HELLO HELLO HELLO'),
        exampleGallery: [ {url: img1} ],
        name: t('CHART CHART CHART'),
        tags: [
          t('Categorical'),
          t('Circular'),
          t('Comparison'),
          t('Percentages'),
          t('Featured'),
          t('Proportional'),
          t('ECharts'),
          t('Nightingale'),
        ],
        thumbnail
      },
    });
  }
}