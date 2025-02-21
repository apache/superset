// DODO was here
// DODO created 44728892
import {
  AdhocMetricSimple,
  Column,
  isAdhocMetricSQL,
  isSavedMetric,
  Maybe,
  Metric,
  QueryFormMetric,
} from '@superset-ui/core';

type Source = Metric | Column | AdhocMetricSimple['column'];

export const extractDatasourceDescriptions = (
  queryFormMetrics: QueryFormMetric[], // Chart Metrics
  datasourceMetrics: Metric[],
  datasourceColumns: Column[],
  locale: string,
): Record<string, string> => {
  const descriptions: Record<string, string> = {};

  const localizedKey = `description_${locale}` as
    | 'description_en'
    | 'description_ru';

  const datasource = [...datasourceMetrics, ...datasourceColumns];
  const datasourceMap = datasource.reduce(
    (acc: Record<string, Source>, source) => {
      const sourceName =
        'metric_name' in source ? source.metric_name : source.column_name;
      acc[sourceName] = source;
      return acc;
    },
    {},
  );

  const getDescription = (source: Source): Maybe<string> | undefined =>
    source[localizedKey] ||
    source.description_ru ||
    source.description_en ||
    source.description;

  const addDescriptionToDictionary = (metric: QueryFormMetric) => {
    if (isAdhocMetricSQL(metric)) return;

    const metricName = isSavedMetric(metric)
      ? metric
      : metric.column.column_name;
    if (!metricName) return;

    const source = datasourceMap[metricName];
    if (!source) return;

    const description = getDescription(source);
    if (!description) return;

    descriptions[metricName] = description;

    const label = isSavedMetric(metric) ? source.verbose_name : metric.label;
    if (label) descriptions[label] = description;
  };

  queryFormMetrics.forEach(queryFormMetric => {
    addDescriptionToDictionary(queryFormMetric);
  });

  return descriptions;
};
