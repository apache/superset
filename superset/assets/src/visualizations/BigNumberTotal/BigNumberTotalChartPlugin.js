import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
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
