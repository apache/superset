import { Behavior, t } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
// Images
import thumbnail from './images/thumbnail.png';
import example1 from './images/Pie1.jpg';
import example2 from './images/Pie2.jpg';
import example3 from './images/Pie3.jpg';
import example4 from './images/Pie4.jpg';
import { EchartsPieChartProps, EchartsPieFormData } from './types';
import { EchartsChartPlugin } from '../types';

export default class EchartsPie2ChartPlugin extends EchartsChartPlugin<
  EchartsPieFormData,
  EchartsPieChartProps
> {
  /**
   * The constructor is used to pass relevant metadata and callbacks that get
   * registered in respective registries that are used throughout the library
   * and application. A more thorough description of each property is given in
   * the respective imported file.
   *
   * It is worth noting that `buildQuery` and is optional, and only needed for
   * advanced visualizations that require either post processing operations
   * (pivoting, rolling aggregations, sorting etc) or submitting multiple queries.
   */
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
        category: t('In Development'),
        credits: ['https://echarts.apache.org'],
        description:
          t(`The classic. Great for showing how much of a company each investor gets, what demographics follow your blog, or what portion of the budget goes to the military industrial complex.
        Pie charts can be difficult to interpret precisely. If clarity of relative proportion is important, consider using a bar or other chart type instead.`),
        exampleGallery: [
          { url: example1 },
          { url: example2 },
          { url: example3 },
          { url: example4 },
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
