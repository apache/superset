import buildQueryContext, { FormData, QueryContext } from 'src/query';

export default function buildQuery(formData: FormData): QueryContext {
  // Override the single QueryObject's groupby with series in formData
  const { datasource, queries } = buildQueryContext(formData);
  const [ query ] = queries;
  return {
    datasource,
    queries: [{
      ...query,
      groupby: [formData.series!],
    }],
  };
}
