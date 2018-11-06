import { t } from '@superset-ui/translation';
import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from '../BigNumber/transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Big Number'),
  description: '',
  thumbnail,
});

export default class BigNumberTotalChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../BigNumber/BigNumber.jsx'),
    });
  }
}
