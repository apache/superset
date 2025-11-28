import { ChartMetadata, ChartPlugin } from '@superset-ui/core';
import controlPanel from './controlPanel';
import thumbnail from './Thumbnail.png';

export default class FlaskChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./FlaskChart'),
      metadata: new ChartMetadata({
        name: 'Flask Chart',
        description: 'Renders a Flask-based chart in a sandboxed iframe',
        thumbnail: thumbnail,
      }),
      controlPanel,
    });
  }
}
