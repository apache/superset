import { SuperChart, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import controlPanel from './controlPanel';
import FlaskChart from './FlaskChart';

export default class FlaskChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./FlaskChart'),
      metadata: new ChartMetadata({
        name: 'Flask Chart',
        description: 'Renders a Flask-based chart in a sandboxed iframe',
        thumbnail: '',
      }),
      controlPanel,
    });
  }
}
