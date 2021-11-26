/* eslint-disable camelcase */
export interface V1ChartDataResponseResult {
  cache_key: string | null;
  cache_timeout: number | null;
  cache_dttm: string | null;
  data: Record<string, unknown>[];
  error: string | null;
  is_cached: boolean;
  query: string;
  rowcount: number;
  stacktrace: string | null;
  status: 'stopped' | 'failed' | 'pending' | 'running' | 'scheduled' | 'success' | 'timed_out';
}

export interface V1ChartDataResponse {
  result: V1ChartDataResponseResult[];
}
