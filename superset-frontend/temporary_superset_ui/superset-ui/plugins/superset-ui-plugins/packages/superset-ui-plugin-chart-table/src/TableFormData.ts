/* eslint-disable camelcase */
import { ChartFormData, ChartFormDataMetric } from '@superset-ui/chart';

type TableFormData = ChartFormData & {
  all_columns: string[];
  percent_metrics: ChartFormDataMetric[];
  include_time: boolean;
  order_by_cols: string[];
};

export default TableFormData;
