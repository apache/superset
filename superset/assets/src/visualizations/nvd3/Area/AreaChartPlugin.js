import ChartPlugin from '../../core/models/ChartPlugin';
import ChartMetadata from '../../core/models/ChartMetadata';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';
import { ANNOTATION_TYPES } from '../../../modules/AnnotationTypes';

const metadata = new ChartMetadata({
  name: 'Area Chart',
  description: '',
  credits: ['http://nvd3.org'],
  supportedAnnotationTypes: [
    ANNOTATION_TYPES.INTERVAL,
    ANNOTATION_TYPES.EVENT,
  ],
  thumbnail,
});

export default class AreaChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../ReactNVD3.js'),
    });
  }
}
