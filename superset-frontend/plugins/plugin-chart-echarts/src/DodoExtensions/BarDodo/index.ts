// DODO added
import {
  Behavior,
  ChartLabel,
  ChartMetadata,
  ChartPlugin,
  t,
} from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import { EchartsBarChartProps, EchartsBarFormData } from './types';

/**
 * @deprecated in version 3.0.
 */
export default class EchartsPieChartPluginDodo extends ChartPlugin<
  EchartsBarFormData,
  EchartsBarChartProps
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
      loadChart: () => import('./EchartsBarChart'),
      metadata: new ChartMetadata({
        label: ChartLabel.DEPRECATED,
        behaviors: [Behavior.INTERACTIVE_CHART],
        credits: ['https://echarts.apache.org'],
        description: 'Bar Chart (Apache ECharts) with D3 format support',
        name: t('Echarts Bar Chart'),
        exampleGallery: [],
        tags: [t('Popular'), t('ECharts'), t('DODOIS_friendly')],
        thumbnail,
      }),
      transformProps,
    });
  }
}
