import { QueryFormData, TimeseriesDataRecord } from '@superset-ui/core';

export type ApplicationsProps = QueryFormData & {
  data: TimeseriesDataRecord[];
  application: string;
  appVal: string[];
  appType: string;
};
