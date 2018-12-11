import { buildQueryObject, QueryObject } from './buildQueryObject';
import { DatasourceKey, DatasourceType } from './DatasourceKey';
import { FormData } from './FormData';

const WRAP_IN_ARRAY = (baseQueryObject: QueryObject) => [baseQueryObject];

export interface QueryContext {
  datasource: {
    id: number;
    type: DatasourceType;
  };
  queries: Array<QueryObject>;
}

export function buildQueryContext(
  formData: FormData,
  buildQuery: (baseQueryObject: QueryObject) => QueryObject[] = WRAP_IN_ARRAY,
): QueryContext {
  return {
    datasource: new DatasourceKey(formData.datasource).toObject(),
    queries: buildQuery(buildQueryObject(formData)),
  };
}
