/* eslint-disable camelcase */
import { QueryFormData, QueryFormMetric } from '@superset-ui/core';

type TableFormData = QueryFormData & {
  all_columns: string[];
  percent_metrics: QueryFormMetric[];
  include_time: boolean;
  order_by_cols: string[];
};

// eslint-disable-next-line no-undef
export default TableFormData;
