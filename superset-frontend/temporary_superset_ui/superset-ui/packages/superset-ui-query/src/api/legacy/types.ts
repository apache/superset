import { V1ChartDataResponseResult } from '../v1/types';

export interface LegacyChartDataResponse extends Omit<V1ChartDataResponseResult, 'data'> {
  data: Record<string, unknown>[] | Record<string, unknown>;
}
