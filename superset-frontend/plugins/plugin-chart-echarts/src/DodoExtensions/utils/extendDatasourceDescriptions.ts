// DODO was here
// DODO created 44728892
import { QueryFormColumn } from '@superset-ui/core';
import type { SeriesOption } from 'echarts';

export const extendDatasourceDescriptions = (
  datasourceDesriptions: Record<string, string>,
  groupBy: QueryFormColumn[],
  series: SeriesOption[],
): Record<string, string> => {
  if (!groupBy.length) return datasourceDesriptions;

  const extendedDatasourceDesriptions = {
    ...datasourceDesriptions,
  };

  series.forEach(option => {
    const { id } = option;

    if (typeof id !== 'string') return;

    const metricName = id.split(', ')[0];

    if (extendedDatasourceDesriptions[metricName]) {
      extendedDatasourceDesriptions[id] =
        extendedDatasourceDesriptions[metricName];
    }
  });

  return extendedDatasourceDesriptions;
};
