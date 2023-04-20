import { AxiosError } from 'axios';
import rison from 'rison';
import { API_HANDLER } from '.';
import { DashboardFiltered } from '../types/global';

const GET_LOGIN_TOKEN = async (
  definedToken?: string,
): Promise<{ access_token: string } | AxiosError> =>
  (await definedToken)
    ? { access_token: definedToken }
    : API_HANDLER.authanticateInDodoInner();

const GET_CSRF_TOKEN = async ({
  useAuth = false,
}: {
  useAuth: boolean;
}): Promise<{ result: string } | AxiosError> =>
  API_HANDLER.getCSRFToken({ useAuth });

async function getDashboardsResult(
  pageCount: number,
  prevResult: null | {
    count: number;
    ids: number[];
    result: DashboardFiltered[];
  },
): Promise<
  { count: number; ids: number[]; result: DashboardFiltered[] } | AxiosError
> {
  const search = [{ col: 'id', opr: 'dashboard_is_certified', value: true }];
  const query = rison.encode({
    keys: ['none'],
    columns: [
      'created_on_delta_humanized',
      'changed_on_delta_humanized',
      'dashboard_title',
      'id',
      'certification_details',
      'certified_by',
      'status',
      'url',
    ],
    filters: search,
    order_column: 'changed_on',
    order_direction: 'desc',
    page: pageCount,
    page_size: 100,
  });

  const data:
    | { count: number; ids: number[]; result: DashboardFiltered[] }
    | AxiosError = await API_HANDLER.SupersetClient({
    method: 'get',
    url: `/api/v1/dashboard/?q=${query}`,
  });

  if ('result' in data) {
    const combinedData = {
      count: data.count,
      ids: data.ids.concat(prevResult?.ids || []),
      result: data.result.concat(prevResult?.result || []),
    };

    if (combinedData.result.length < combinedData.count)
      return getDashboardsResult(pageCount + 1, combinedData);

    return combinedData;
  }

  return data;
}

const GET_DASHBOARDS = async (): Promise<
  { result: DashboardFiltered[] } | AxiosError
> => getDashboardsResult(0, null);

export { GET_LOGIN_TOKEN, GET_CSRF_TOKEN, GET_DASHBOARDS };
