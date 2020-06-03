import { SupersetClientInterface, SupersetClient, RequestConfig } from '@superset-ui/connection';
import { QueryContext } from '../../types/Query';
import { V1ChartDataResponse } from './types';

export interface Params {
  client?: SupersetClientInterface;
  requestConfig?: Partial<RequestConfig>;
  queryContext: QueryContext;
}

export default function postChartData({
  client = SupersetClient,
  requestConfig,
  queryContext,
}: Params) {
  return client
    .post({
      ...requestConfig,
      endpoint: '/api/v1/chart/data',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryContext),
    } as RequestConfig)
    .then(({ json }) => json as V1ChartDataResponse);
}
