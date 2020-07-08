import { QueryFields, QueryFormResidualData } from './types/QueryFormData';
import { QueryFieldData } from './types/Query';

export default function extractQueryFields(
  residualFormData: QueryFormResidualData,
  queryFields?: QueryFields,
) {
  const queryFieldAliases: QueryFields = {
    /** These are predefined for backward compatibility */
    metric: 'metrics',
    percent_metrics: 'metrics',
    metric_2: 'metrics',
    secondary_metric: 'metrics',
    x: 'metrics',
    y: 'metrics',
    size: 'metrics',
    ...queryFields,
  };
  const finalQueryFields: QueryFieldData = {
    columns: [],
    groupby: [],
    metrics: [],
  };
  Object.entries(residualFormData).forEach(entry => {
    const [key, residualValue] = entry;
    const normalizedKey = queryFieldAliases[key] || key;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    finalQueryFields[normalizedKey] = (finalQueryFields[normalizedKey] || []).concat(residualValue);
  });
  return finalQueryFields;
}
