import buildQueryObject from './buildQueryObject';
import DatasourceKey from './DatasourceKey';
import { QueryFieldAliases, QueryFormData } from './types/QueryFormData';
import { QueryContext, QueryObject } from './types/Query';

const WRAP_IN_ARRAY = (baseQueryObject: QueryObject) => [baseQueryObject];

export type BuildFinalQuerieObjects = (baseQueryObject: QueryObject) => QueryObject[];

export default function buildQueryContext(
  formData: QueryFormData,
  options?:
    | {
        buildQuery?: BuildFinalQuerieObjects;
        queryFields?: QueryFieldAliases;
      }
    | BuildFinalQuerieObjects,
): QueryContext {
  const { queryFields, buildQuery = WRAP_IN_ARRAY } =
    typeof options === 'function' ? { buildQuery: options, queryFields: {} } : options || {};
  return {
    datasource: new DatasourceKey(formData.datasource).toObject(),
    force: formData.force || false,
    queries: buildQuery(buildQueryObject(formData, queryFields)),
    result_format: formData.result_format || 'json',
    result_type: formData.result_type || 'full',
  };
}
