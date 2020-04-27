import { t } from '@superset-ui/translation';
import { ChartMetadata } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';

export default function createMetadata(useLegacyApi = false) {
  return new ChartMetadata({
    description: '',
    name: t('Line Chart'),
    thumbnail,
    useLegacyApi,
  });
}
