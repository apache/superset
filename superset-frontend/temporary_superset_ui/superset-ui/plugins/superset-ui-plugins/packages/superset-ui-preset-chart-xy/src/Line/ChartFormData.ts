import { ChartFormData } from '@superset-ui/chart';
import { Margin } from '@superset-ui/dimension';
import { Encoding } from './Encoder';

type LineFormData = ChartFormData & {
  encoding: Encoding;
  margin?: Margin;
};

export default LineFormData;
