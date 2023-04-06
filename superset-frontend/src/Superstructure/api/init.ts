import { AxiosError } from 'axios';
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

const GET_DASHBOARDS = (): Promise<
  { result: DashboardFiltered[] } | AxiosError
> =>
  API_HANDLER.SupersetClient({
    method: 'get',
    url: '/api/v1/dashboard/',
  });

export { GET_LOGIN_TOKEN, GET_CSRF_TOKEN, GET_DASHBOARDS };
