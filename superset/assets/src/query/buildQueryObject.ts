import FormData, { getGranularity } from './FormData';
import Metric, { Metrics } from './Metric';

// TODO: fill out the rest of the query object
export interface QueryObject {
  granularity: string;
  groupby?: string[];
  metrics?: Metric[];
}

// Build the common segments of all query objects (e.g. the granularity field derived from
// either sql alchemy or druid). The segments specific to each viz type is constructed in the
// buildQuery method for each viz type (see `wordcloud/buildQuery.ts` for an example).
// Note the type of the formData argument passed in here is the type of the formData for a
// specific viz, which is a subtype of the generic formData shared among all viz types.
export default function buildQueryObject<T extends FormData>(formData: T): QueryObject {
  return {
    granularity: getGranularity(formData),
    metrics: new Metrics(formData).getMetrics(),
  };
}
