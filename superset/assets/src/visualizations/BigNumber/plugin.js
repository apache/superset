import ChartPlugin from '../../superset-ui-core/chart/models/ChartPlugin';
import BigNumber from './BigNumber';
import transformProps from './transformProps';
import metadata from './metadata';

export default new ChartPlugin({
  key: 'big-number',
  metadata,
  transformProps,
  Chart: BigNumber,
});
