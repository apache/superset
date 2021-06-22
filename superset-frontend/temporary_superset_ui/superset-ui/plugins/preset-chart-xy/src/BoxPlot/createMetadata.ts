import { t, ChartMetadata } from '@superset-ui/core';
import thumbnail from './images/thumbnail.png';

export default function createMetadata(useLegacyApi = false) {
  return new ChartMetadata({
    category: t('Distribution'),
    description: '',
    name: t('Box Plot'),
    thumbnail,
    useLegacyApi,
  });
}
