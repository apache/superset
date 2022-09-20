import { Dataset } from '@superset-ui/chart-controls/src/types';

export const MULTI_DATASET_JOIN_KEY = 'multi_table_name';

export function isMultiDatasource(datasource: Dataset) {
  return datasource.extra
    ? !!JSON.parse(datasource.extra)[MULTI_DATASET_JOIN_KEY]
    : false;
}
