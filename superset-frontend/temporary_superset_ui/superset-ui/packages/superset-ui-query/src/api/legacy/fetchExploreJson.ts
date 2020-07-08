import { SupersetClient, Method, Endpoint } from '@superset-ui/connection';
import { QueryFormData } from '../../types/QueryFormData';
import { LegacyChartDataResponse } from './types';
import { BaseParams } from '../types';

export interface Params extends BaseParams {
  method?: Method;
  endpoint?: Endpoint;
  formData: QueryFormData;
}

export default async function fetchExploreJson({
  client = SupersetClient,
  method = 'POST',
  requestConfig,
  endpoint = '/superset/explore_json/',
  formData,
}: Params) {
  const { json } = await client.request({
    ...requestConfig,
    method,
    endpoint,
    // TODO: Have to transform formData as query string for GET
    postPayload: { form_data: formData },
  });
  return json as LegacyChartDataResponse;
}
