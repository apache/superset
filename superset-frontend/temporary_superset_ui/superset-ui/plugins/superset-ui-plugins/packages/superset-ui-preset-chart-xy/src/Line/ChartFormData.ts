import { ChartFormData } from '@superset-ui/chart';
import { Margin } from '@superset-ui/dimension';
import { ChartTheme } from '@data-ui/theme';
import { Encoding } from './Encoder';

type LineFormData = ChartFormData & {
  encoding: Encoding;
  margin?: Margin;
  theme?: ChartTheme;
};

export default LineFormData;
