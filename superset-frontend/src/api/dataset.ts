import { SupersetClient, JsonResponse } from '@superset-ui/core';
import rison from 'rison';

export const get = async () => {
  const queryParams = rison.encode({
    order_column: 'changed_on_delta_humanized',
    order_direction: 'desc',
    page: 0,
    page_size: 10,
  });
  const endpoint = `/api/v1/dataset?q=${queryParams}`;
  const data: JsonResponse = await SupersetClient.get({
    endpoint,
  });
  console.log(data);
  return data.json.result;
};
