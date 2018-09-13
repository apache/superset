import ChartPlugin from '../../superset-ui-core/chart/models/ChartPlugin';
import metadata from './metadata';

export default new ChartPlugin({
  key: 'big-number',
  metadata,
  loadTransformProps: () => import('./transformProps.js'),
  loadChart: () => import('./BigNumber.jsx'),
});
