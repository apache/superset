import { t } from '@superset-ui/translation';
import ChartPlugin from '../../core/models/ChartPlugin';
import ChartMetadata from '../../core/models/ChartMetadata';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';
import { ANNOTATION_TYPES } from '../../../modules/AnnotationTypes';

const metadata = new ChartMetadata({
  name: t('Line Chart'),
  description: '',
  credits: ['http://nvd3.org'],
  canBeAnnotationTypes: [
    ANNOTATION_TYPES.TIME_SERIES,
  ],
  supportedAnnotationTypes: [
    ANNOTATION_TYPES.TIME_SERIES,
    ANNOTATION_TYPES.INTERVAL,
    ANNOTATION_TYPES.EVENT,
    ANNOTATION_TYPES.FORMULA,
  ],
  thumbnail,
});

export default class LineChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../ReactNVD3.js'),
    });
  }
}
