import { SupersetClient, RequestConfig } from '@superset-ui/connection';
import { QueryFormData } from '../../types/QueryFormData';
import { LegacyChartDataResponse } from './types';
import { BaseParams } from '../types';

export interface Params extends BaseParams {
  method?: 'GET' | 'POST';
  url?: string;
  formData: QueryFormData;
}

export default function fetchExploreJson({
  client = SupersetClient,
  method = 'POST',
  requestConfig,
  url = '/superset/explore_json/',
  formData,
}: Params) {
  const fetchFunc = method === 'GET' ? client.get : client.post;

  return fetchFunc({
    ...requestConfig,
    // TODO: Have to transform formData as query string for GET
    url,
    postPayload: { form_data: formData },
  } as RequestConfig).then(({ json }) => json as LegacyChartDataResponse);
}
