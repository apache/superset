// DODO was here
// DODO created 45525377
import { QueryFormColumn } from '@superset-ui/core';
import { ColumnConfig, MetricsLayoutEnum } from '../../types';

export const METRIC_KEY = 'Metric';

export const getPinnedColumnIndexes = ({
  columnConfig,
  combineMetric,
  groupbyColumns,
  groupbyRows,
  metricsLayout,
  transposePivot,
}: {
  columnConfig: ColumnConfig;
  combineMetric: boolean;
  groupbyColumns: QueryFormColumn[];
  groupbyRows: QueryFormColumn[];
  metricsLayout: MetricsLayoutEnum;
  transposePivot: boolean;
}): number[] => {
  if (!columnConfig) return [];

  const indexes: number[] = [];

  const group = transposePivot ? groupbyColumns : groupbyRows;
  const isRowsLayout = metricsLayout === MetricsLayoutEnum.ROWS;
  const groupWithMetric = combineMetric
    ? [...group, METRIC_KEY]
    : [METRIC_KEY, ...group];
  const columns = !isRowsLayout ? group : groupWithMetric;

  columns.forEach((row: string, index: number) => {
    if (columnConfig[row]?.pinColumn) indexes.push(index);
  });

  return indexes;
};
