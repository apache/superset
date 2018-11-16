import buildDatasource from './buildDatasource';
import buildQueryObject, { QueryObject } from './buildQueryObject';
import FormData from './FormData';

const WRAP_IN_ARRAY = (baseQueryObject: QueryObject) => [baseQueryObject];

// Note: let TypeScript infer the return type
export default function buildQueryContext(
  formData: FormData,
  buildQuery: (baseQueryObject: QueryObject) => QueryObject[] = WRAP_IN_ARRAY) {
  return {
    datasource: buildDatasource(formData),
    queries: buildQuery(buildQueryObject(formData)),
  };
}
