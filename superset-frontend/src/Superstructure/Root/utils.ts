import { GET_LOGIN_TOKEN, GET_CSRF_TOKEN, GET_DASHBOARDS } from '../api/init';
import { MESSAGES } from '../constants';
import {
  InitializedResponse,
  DashboardFiltered,
  RouteFromDashboard,
} from '../types/global';
import {
  handleAxiosError,
  handleCorrectCaseReturn,
  handleDefaultCaseReturn,
} from './helpers';

const dirtyHackDodoIs = () => {
  // In dodois the div.all has css property min-height, that forces the footer to be overlapped
  const dodoElementAll = document.getElementsByClassName('all')[0];

  if (dodoElementAll && dodoElementAll.classList.contains('overwrite-height')) {
    dodoElementAll.classList.remove('overwrite-height');
  }
};

const getLoginToken = async (): Promise<
  InitializedResponse<{ access_token: string } | null>
> => {
  const loginResponse = await GET_LOGIN_TOKEN();

  if ('code' in loginResponse) {
    return handleAxiosError({
      response: loginResponse,
      errorObject: MESSAGES.LOGIN,
    });
  }

  if ('access_token' in loginResponse) {
    return handleCorrectCaseReturn<{ access_token: string }>({
      response: loginResponse,
      errorObject: MESSAGES.LOGIN,
    });
  }

  return handleDefaultCaseReturn({
    errorObject: MESSAGES.LOGIN,
    errorMessage: 'NO_TOKEN',
  });
};

const getCsrfToken = async ({
  useAuth = true,
}): Promise<InitializedResponse<{ result: string } | null>> => {
  const csrfResponse = await GET_CSRF_TOKEN({ useAuth });

  if ('code' in csrfResponse) {
    return handleAxiosError({
      response: csrfResponse,
      errorObject: MESSAGES.CSRF,
    });
  }

  if ('result' in csrfResponse) {
    return handleCorrectCaseReturn<{ result: string }>({
      response: csrfResponse,
      errorObject: MESSAGES.CSRF,
    });
  }

  return handleDefaultCaseReturn({
    errorObject: MESSAGES.CSRF,
    errorMessage: 'NO_TOKEN',
  });
};

const getDashboardsData = async (): Promise<
  InitializedResponse<DashboardFiltered[] | null>
> => {
  const dashboardsResponse = await GET_DASHBOARDS();

  if ('code' in dashboardsResponse) {
    return handleAxiosError({
      response: dashboardsResponse,
      errorObject: MESSAGES.GET_MENU,
    });
  }

  if ('result' in dashboardsResponse) {
    return handleCorrectCaseReturn<DashboardFiltered[]>({
      response: dashboardsResponse.result,
      errorObject: MESSAGES.GET_MENU,
    });
  }

  return handleDefaultCaseReturn({
    errorObject: MESSAGES.GET_MENU,
    errorMessage: 'NO_DASHBOARDS',
  });
};

const defineNavigation = (
  dashboards: DashboardFiltered[],
): RouteFromDashboard[] =>
  dashboards.map(dashboard => {
    const {
      certification_details = '',
      certified_by = '',
      dashboard_title = '',
      id,
    } = dashboard;

    return {
      hidden: !certified_by,
      idOrSlug: id,
      name: dashboard_title,
      location: certification_details,
      isMainRoute: false,
    };
  });

export {
  getLoginToken,
  getCsrfToken,
  getDashboardsData,
  dirtyHackDodoIs,
  defineNavigation,
};
