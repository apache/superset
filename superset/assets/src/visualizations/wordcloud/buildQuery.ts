import buildQueryContext, { QueryContext } from 'src/query';
import { FormData } from './formData';

export default function buildQuery(formData: FormData): QueryContext {
  // Set the single QueryObject's groupby field with series in formData
  const { datasource, queries } = buildQueryContext(formData);
  const [ query ] = queries;
  return {
    datasource,
    queries: [{
      ...query,
      groupby: [formData.series],
    }],
  };
}
