import { SupersetClient } from '../../../connection';
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
    })
    .then(({ json }) => json as QueryFormData);

  return overrideFormData
    ? promise.then(formData => ({ ...formData, ...overrideFormData }))
    : promise;
}
