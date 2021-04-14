import buildQueryObject from './buildQueryObject';
import DatasourceKey from './DatasourceKey';
import { QueryFieldAliases, QueryFormData } from './types/QueryFormData';
import { QueryContext, QueryObject } from './types/Query';
import { SetDataMaskHook } from '../chart';
import { JsonObject } from '../connection';

const WRAP_IN_ARRAY = (
  baseQueryObject: QueryObject,
  options?: {
    extras?: {
      cachedChanges?: any;
    };
    ownState?: JsonObject;
    hooks?: {
      setDataMask: SetDataMaskHook;
      setCachedChanges: (newChanges: any) => void;
    };
  },
) => [baseQueryObject];

export type BuildFinalQueryObjects = (baseQueryObject: QueryObject) => QueryObject[];

export default function buildQueryContext(
  formData: QueryFormData,
  options?:
    | {
        buildQuery?: BuildFinalQueryObjects;
        queryFields?: QueryFieldAliases;
        ownState?: JsonObject;
        hooks?: { setDataMask: SetDataMaskHook };
      }
    | BuildFinalQueryObjects,
): QueryContext {
  const { queryFields, buildQuery = WRAP_IN_ARRAY, hooks = {}, ownState = {} } =
    typeof options === 'function' ? { buildQuery: options, queryFields: {} } : options || {};
  return {
    datasource: new DatasourceKey(formData.datasource).toObject(),
    force: formData.force || false,
    queries: buildQuery(buildQueryObject(formData, queryFields), {
      extras: {},
      ownState,
      hooks: {
        setDataMask: () => {},
        setCachedChanges: () => {},
        ...hooks,
      },
    }),
    result_format: formData.result_format || 'json',
    result_type: formData.result_type || 'full',
  };
}
