import { t, ChartMetadata } from '@superset-ui/core';
import thumbnail from './images/thumbnail.png';

export default function createMetadata(useLegacyApi = false) {
  return new ChartMetadata({
    description: '',
    name: t('Line Chart'),
    thumbnail,
    useLegacyApi,
  });
}
