import { ChartFormData, FormDataMetric } from '@superset-ui/chart';

type TableFormData = ChartFormData & {
  all_columns: string[];
  percent_metrics: FormDataMetric[];
  include_time: boolean;
  order_by_cols: string[];
};

export default TableFormData;
