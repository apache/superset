import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import thumbnail from './images/thumbnail.png';
import Chart from './StatusIndicatorChart';
import { FormData } from './types';

const metadata = new ChartMetadata({
  description:
    'A chart plugin for Superset demonstrating current best practices',
  name: t('Status Indicator'),
  thumbnail,
  useLegacyApi: false,
});

export default class StatusIndicatorChartPlugin extends ChartPlugin<FormData> {
  constructor() {
    super({
      buildQuery,
      Chart,
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
