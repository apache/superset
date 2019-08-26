/* eslint-disable camelcase */
import { QueryFormData, QueryFormDataMetric } from '@superset-ui/query';

type TableFormData = QueryFormData & {
  all_columns: string[];
  percent_metrics: QueryFormDataMetric[];
  include_time: boolean;
  order_by_cols: string[];
};

export default TableFormData;
