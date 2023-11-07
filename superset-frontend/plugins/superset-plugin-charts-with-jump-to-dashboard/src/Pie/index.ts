import { Behavior, t } from '@superset-ui/core';
import { EchartsChartPlugin } from '@superset-ui/plugin-chart-echarts';
import controlPanel from './controlPanel';
import {
  EchartsPieChartProps,
  EchartsPieFormData,
} from '../../../plugin-chart-echarts/src/Pie/types';
import buildQuery from '../../../plugin-chart-echarts/src/Pie/buildQuery';
import transformProps from '../../../plugin-chart-echarts/src/Pie/transformProps';
import thumbnail from '../../../plugin-chart-echarts/src/Pie/images/thumbnail.png';
import example1 from '../../../plugin-chart-echarts/src/Pie/images/Pie1.jpg';

export default class EchartsPieChartJTDPlugin extends EchartsChartPlugin<
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
          Behavior.INTERACTIVE_CHART,
          Behavior.DRILL_TO_DETAIL,
          Behavior.DRILL_BY,
        ],
        category: t('Part of a Whole'),
        credits: ['https://echarts.apache.org', '.mo.'],
        description: t(`ECharts with Jump to Dashboard - Pie Chart`),
        exampleGallery: [{ url: example1 }],
        name: t('Pie Chart JTD'),
        tags: [
          t('Aesthetic'),
          t('Categorical'),
          t('Circular'),
          t('Comparison'),
          t('Percentages'),
          t('Popular'),
          t('Proportional'),
          t('ECharts'),
        ],
        thumbnail,
      },
      transformProps,
    });
  }
}
