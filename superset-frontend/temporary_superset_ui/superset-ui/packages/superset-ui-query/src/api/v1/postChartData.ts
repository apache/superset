import { SupersetClient } from '@superset-ui/connection';
import { QueryContext } from '../../types/Query';
import { BaseParams } from '../types';
import { V1ChartDataResponse } from './types';

export interface Params extends BaseParams {
  queryContext: QueryContext;
}

export default async function postChartData({
  client = SupersetClient,
  requestConfig,
  queryContext,
}: Params) {
  const { json } = await client.post({
    ...requestConfig,
    endpoint: '/api/v1/chart/data',
    jsonPayload: queryContext,
  });
  return json as V1ChartDataResponse;
}
