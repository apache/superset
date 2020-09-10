import { SupersetClient, Method, Endpoint } from '../../../connection';
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
    searchParams:
      method === 'GET' ? new URLSearchParams({ form_data: JSON.stringify(formData) }) : undefined,
    postPayload: method === 'POST' ? { form_data: formData } : undefined,
  });
  return json as LegacyChartDataResponse;
}
