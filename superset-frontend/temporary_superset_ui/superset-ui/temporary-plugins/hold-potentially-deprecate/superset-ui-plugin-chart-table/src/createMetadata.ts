import { t, ChartMetadata } from '@superset-ui/core';
import thumbnail from './images/thumbnail.png';

export default function createMetadata(useLegacyApi = false) {
  return new ChartMetadata({
    canBeAnnotationTypes: ['EVENT', 'INTERVAL'],
    description: '',
    name: t('Table'),
    thumbnail,
    useLegacyApi,
  });
}
