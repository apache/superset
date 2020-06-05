import {
  RequestConfig,
  SupersetClientInterface,
  SupersetClientClass,
} from '@superset-ui/connection';

export interface BaseParams {
  client?: SupersetClientInterface | SupersetClientClass;
  requestConfig?: Partial<RequestConfig>;
}
