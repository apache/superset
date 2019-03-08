import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import { ANNOTATION_TYPES } from '../../modules/AnnotationTypes';

const metadata = new ChartMetadata({
  name: t('Table'),
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
