import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import { ANNOTATION_TYPES } from '../../modules/AnnotationTypes';

const metadata = new ChartMetadata({
  name: 'Table',
  description: '',
  canBeAnnotationTypes: [
    ANNOTATION_TYPES.EVENT,
    ANNOTATION_TYPES.INTERVAL,
  ],
  thumbnail,
});

export default class TableChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactTable.js'),
    });
  }
}
