import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';
import { ANNOTATION_TYPES } from '../../../modules/AnnotationTypes';

const metadata = new ChartMetadata({
  name: t('Time-series Bar Chart'),
  description: 'A bar chart where the x axis is time',
  credits: ['http://nvd3.org'],
  supportedAnnotationTypes: [
    ANNOTATION_TYPES.INTERVAL,
    ANNOTATION_TYPES.EVENT,
  ],
  thumbnail,
});

export default class BarChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../ReactNVD3.js'),
    });
  }
}
