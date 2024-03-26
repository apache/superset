import { AxiosError } from 'axios';
import rison from 'rison';
import { API_HANDLER } from '.';
import {
  DashboardFiltered,
  AnnotationLayersFiltered,
  SingleAnnotation,
} from '../types/global';
import { API_V1 } from '../constants';

const DASHBOARDS_ENDPOINT = `${API_V1}/dashboard`;
const ANNOTATION_LAYERS_ENDPOINT = `${API_V1}/annotation_layer`;

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
      // DODO added
      'dashboard_title_RU',
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
    url: `${DASHBOARDS_ENDPOINT}/?q=${query}`,
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

async function getAnnotationLayersResult(
  pageCount: number,
  prevResult: null | {
    count: number;
    ids: number[];
    result: AnnotationLayersFiltered[];
  },
): Promise<
  | { count: number; ids: number[]; result: AnnotationLayersFiltered[] }
  | AxiosError
> {
  const query = rison.encode({
    keys: ['none'],
    columns: [
      'id',
      'name',
      'descr',
      'created_on',
      'changed_on',
      'changed_on_delta_humanized',
    ],
    order_column: 'created_on',
    order_direction: 'desc',
    page: pageCount,
    page_size: 100,
  });

  const data:
    | { count: number; ids: number[]; result: AnnotationLayersFiltered[] }
    | AxiosError = await API_HANDLER.SupersetClient({
    method: 'get',
    url: `${ANNOTATION_LAYERS_ENDPOINT}/?q=${query}`,
  });

  if ('result' in data) {
    const combinedData = {
      count: data.count,
      ids: data.ids.concat(prevResult?.ids || []),
      result: data.result.concat(prevResult?.result || []),
    };

    if (combinedData.result.length < combinedData.count)
      return getAnnotationLayersResult(pageCount + 1, combinedData);

    return combinedData;
  }

  return data;
}

async function getSingleAnnotationLayerIdsResult(
  pageCount: number,
  prevResult: null | {
    count: number;
    ids: number[];
  },
  layerId: number,
): Promise<{ count: number; ids: number[] } | AxiosError> {
  const query = rison.encode({
    order_column: 'short_descr',
    order_direction: 'desc',
    page: pageCount,
    page_size: 100,
  });

  const data: { count: number; ids: number[] } | AxiosError =
    await API_HANDLER.SupersetClient({
      method: 'get',
      url: `${ANNOTATION_LAYERS_ENDPOINT}/${layerId}/annotation/?q=${query}`,
    });

  if ('ids' in data) {
    const combinedData = {
      count: data.count,
      ids: data.ids.concat(prevResult?.ids || []),
    };

    if (combinedData.ids.length < combinedData.count)
      return getSingleAnnotationLayerIdsResult(
        pageCount + 1,
        combinedData,
        layerId,
      );

    return combinedData;
  }

  return data;
}

async function getSingleAnnotationResult(
  layerId: number,
  annotationId: number,
): Promise<{ result: SingleAnnotation } | AxiosError> {
  const data: { result: SingleAnnotation } | AxiosError =
    await API_HANDLER.SupersetClient({
      method: 'get',
      url: `${ANNOTATION_LAYERS_ENDPOINT}/${layerId}/annotation/${annotationId}`,
    });

  if ('result' in data) {
    const combinedData = {
      result: data.result,
    };

    return combinedData;
  }

  return data;
}

const GET_DASHBOARDS = async (): Promise<
  { result: DashboardFiltered[] } | AxiosError
> => getDashboardsResult(0, null);

const GET_ANNOTATION_LAYERS = async (): Promise<
  { result: AnnotationLayersFiltered[] } | AxiosError
> => getAnnotationLayersResult(0, null);

const GET_SINGLE_ANNOTATION_LAYER_IDS = async (
  layerId: number,
): Promise<{ ids: number[] } | AxiosError> =>
  getSingleAnnotationLayerIdsResult(0, null, layerId);

const GET_SINGLE_ANNOTATION = async (
  layerId: number,
  annotationId: number,
): Promise<{ result: SingleAnnotation } | AxiosError> =>
  getSingleAnnotationResult(layerId, annotationId);

export {
  GET_LOGIN_TOKEN,
  GET_CSRF_TOKEN,
  GET_DASHBOARDS,
  GET_ANNOTATION_LAYERS,
  GET_SINGLE_ANNOTATION_LAYER_IDS,
  GET_SINGLE_ANNOTATION,
};
