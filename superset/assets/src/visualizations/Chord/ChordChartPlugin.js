import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Chord Diagram'),
  description: '',
  credits: ['https://github.com/d3/d3-chord'],
  thumbnail,
});

export default class ChordChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactChord.js'),
    });
  }
}
