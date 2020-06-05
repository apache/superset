import { SupersetClient, RequestConfig } from '@superset-ui/connection';
import { BaseParams } from '../types';
import { QueryFormData } from '../../types/QueryFormData';

export interface Params extends BaseParams {
  sliceId: number;
  overrideFormData?: Partial<QueryFormData>;
}

export default function getFormData({
  client = SupersetClient,
  sliceId,
  overrideFormData,
  requestConfig,
}: Params) {
  const promise = client
    .get({
      endpoint: `/api/v1/form_data/?slice_id=${sliceId}`,
      ...requestConfig,
    } as RequestConfig)
    .then(response => response.json as QueryFormData);

  return overrideFormData
    ? promise.then(formData => ({ ...formData, ...overrideFormData }))
    : promise;
}
