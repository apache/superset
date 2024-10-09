import { Behavior, t } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
// Images
import thumbnail from './images/chiro.png'
import example1 from './images/aspi.png'

import { EchartsPieChartProps, EchartsPieFormData } from './types';
import { EchartsChartPlugin } from '../types';

export default class EchartsPie2ChartPlugin extends EchartsChartPlugin<
  EchartsPieFormData,
  EchartsPieChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsPie'),
      metadata: {
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
        ],
        category: t('!In Development'),
        credits: ['https://echarts.apache.org'],
        description:
          t(`The classic. Great for showing how much of a company each investor gets, what demographics follow your blog, or what portion of the budget goes to the military industrial complex.
        Pie charts can be difficult to interpret precisely. If clarity of relative proportion is important, consider using a bar or other chart type instead.`),
        exampleGallery: [
          { url: example1 },
        ],
        name: t('Custom Pie Chart'),
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
        thumbnail,
      },
      transformProps,
    });
  }
}
