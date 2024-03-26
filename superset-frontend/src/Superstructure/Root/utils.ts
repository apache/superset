import {
  GET_LOGIN_TOKEN,
  GET_CSRF_TOKEN,
  GET_DASHBOARDS,
  GET_ANNOTATION_LAYERS,
  GET_SINGLE_ANNOTATION_LAYER_IDS,
  GET_SINGLE_ANNOTATION,
} from '../api/init';
import { KNOWN_CERTIFICATAION_DETAILS, MESSAGES } from '../constants';
import {
  InitializedResponse,
  DashboardFiltered,
  AnnotationLayersFiltered,
  RouteFromDashboard,
  SingleAnnotation,
} from '../types/global';
import {
  handleAxiosError,
  handleCorrectCaseReturn,
  handleDefaultCaseReturn,
} from './helpers';

const dirtyHackDodoIs = () => {
  // In dodois the div.all has css property min-height, that forces the footer to be overlapped
  const dodoElementAll = document.getElementsByClassName('all')[0];

  if (dodoElementAll?.classList.contains('overwrite-height')) {
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
    const csrfResponseAltered = {
      ...csrfResponse,
      message:
        'Проверьте, что в Вашей учетной записи Dodo IS заполнены e-mail, имя и фамилия. При отсутствии этих данных, авторизация в сервисе невозможна',
    };
    return handleAxiosError({
      response: csrfResponseAltered,
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

const getSingleAnnotationData = async (
  layerId: number,
  annotationId: number,
): Promise<InitializedResponse<{ result: SingleAnnotation } | null>> => {
  const singleAnnotationResponse = await GET_SINGLE_ANNOTATION(
    layerId,
    annotationId,
  );

  if ('code' in singleAnnotationResponse) {
    return handleAxiosError({
      response: singleAnnotationResponse,
      errorObject: MESSAGES.GET_ANNOTATION,
    });
  }

  if ('result' in singleAnnotationResponse) {
    return handleCorrectCaseReturn<{ result: SingleAnnotation }>({
      response: {
        result: singleAnnotationResponse.result,
      },
      errorObject: MESSAGES.GET_ANNOTATION,
    });
  }

  return handleDefaultCaseReturn({
    errorObject: MESSAGES.GET_ANNOTATION,
    errorMessage: 'NO_ANNOTATION',
  });
};

const getSingleAnnotationLayerIdsData = async (
  layerId: number,
): Promise<InitializedResponse<{ ids: number[]; layerId: number } | null>> => {
  const singleAnnotationLayerIdsResponse =
    await GET_SINGLE_ANNOTATION_LAYER_IDS(layerId);

  if ('code' in singleAnnotationLayerIdsResponse) {
    return handleAxiosError({
      response: singleAnnotationLayerIdsResponse,
      errorObject: MESSAGES.GET_ANNOTATION,
    });
  }

  if ('ids' in singleAnnotationLayerIdsResponse) {
    return handleCorrectCaseReturn<{ ids: number[]; layerId: number }>({
      response: {
        layerId,
        ids: singleAnnotationLayerIdsResponse.ids,
      },
      errorObject: MESSAGES.GET_ANNOTATION,
    });
  }

  return handleDefaultCaseReturn({
    errorObject: MESSAGES.GET_ANNOTATION,
    errorMessage: 'NO_ANNOTATION',
  });
};

const getAnnotationLayersData = async (): Promise<
  InitializedResponse<AnnotationLayersFiltered[] | null>
> => {
  const annotationLayersResponse = await GET_ANNOTATION_LAYERS();

  if ('code' in annotationLayersResponse) {
    return handleAxiosError({
      response: annotationLayersResponse,
      errorObject: MESSAGES.GET_ANNOTATION_LAYERS,
    });
  }

  if ('result' in annotationLayersResponse) {
    return handleCorrectCaseReturn<AnnotationLayersFiltered[]>({
      response: annotationLayersResponse.result,
      errorObject: MESSAGES.GET_ANNOTATION_LAYERS,
    });
  }

  return handleDefaultCaseReturn({
    errorObject: MESSAGES.GET_ANNOTATION_LAYERS,
    errorMessage: 'NO_ANNOTATION_LAYERS',
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
      // DODO added
      dashboard_title_RU = '',
      id,
    } = dashboard;

    return {
      hidden: !certified_by,
      idOrSlug: id,
      name: dashboard_title,
      nameRU: dashboard_title_RU || dashboard_title,
      location: certification_details,
      isMainRoute: false,
    };
  });

const sortDashboards = (
  dashboards: RouteFromDashboard[],
  sortingIds: any[],
): RouteFromDashboard[] => {
  const sortDashboards = (array: RouteFromDashboard[], sortArray: any[]) =>
    [...array].sort(
      (a, b) => sortArray.indexOf(a.idOrSlug) - sortArray.indexOf(b.idOrSlug),
    );

  return sortDashboards(dashboards, sortingIds);
};

const cleanUpString = (str: string) => str.toLocaleLowerCase().trim();

const prepareBusinessId = (str: string) =>
  str
    .split(' ')
    .filter(x => x)
    .map(x => cleanUpString(x))
    .join('')
    .split(',');

const validCertifiedBy = (businessId: string, cert_by: string | null) => {
  if (!cert_by) return false;

  return prepareBusinessId(cert_by).indexOf(businessId) >= 0;
};

const validCertificationDetails = (cert_details: string | null) =>
  cert_details &&
  KNOWN_CERTIFICATAION_DETAILS.indexOf(
    cert_details.toLocaleLowerCase().trim(),
  ) >= 0;

export {
  getLoginToken,
  getCsrfToken,
  getDashboardsData,
  getAnnotationLayersData,
  getSingleAnnotationLayerIdsData,
  getSingleAnnotationData,
  dirtyHackDodoIs,
  defineNavigation,
  sortDashboards,
  validCertifiedBy,
  validCertificationDetails,
};
