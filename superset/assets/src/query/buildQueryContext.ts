import buildDatasource from './buildDatasource';
import buildQueries from './buildQueries';
import { FormData } from './formData';

// Note: let TypeScript infer the return type
export default function buildQueryContext(formData: FormData) {
  return {
    datasource: buildDatasource(formData),
    queries: buildQueries(formData),
  };
}
