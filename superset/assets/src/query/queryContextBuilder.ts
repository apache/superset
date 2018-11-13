import buildDatasource, { Datasource } from './datasourceBuilder';
import { FormData } from './formData';
import buildQueries, { QueryObject } from './queryObjectBuilder';

export interface QueryContext {
  datasource: Datasource;
  queries: QueryObject[];
}

export default function build(formData: FormData): QueryContext {
  return {
    datasource: buildDatasource(formData),
    queries: buildQueries(formData),
  };
}
