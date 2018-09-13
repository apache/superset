import ChartPlugin from '../../superset-ui-superchart/ChartPlugin';
import BigNumber from './BigNumber';

export default new ChartPlugin({
  key: 'big-number',
  metadata,
  transformProps,
  Component: BigNumber,
});
