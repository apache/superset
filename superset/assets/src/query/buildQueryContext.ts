import buildDatasource, { Datasource } from './buildDatasource';
import buildQueries, { QueryObject } from './buildQueryObject';
import { FormData } from './formData';

export interface QueryContext {
  datasource: Datasource;
  queries: QueryObject[];
}

export default function buildQueryContext(formData: FormData): QueryContext {
  return {
    datasource: buildDatasource(formData),
    queries: buildQueries(formData),
  };
}
