import { DecodedValueMap, QueryParamConfigMap } from 'serialize-query-params';
import { SetQuery } from './types';
/**
 * Given a query parameter configuration (mapping query param name to { encode, decode }),
 * return an object with the decoded values and a setter for updating them.
 */
export declare const useQueryParams: <QPCMap extends QueryParamConfigMap>(paramConfigMap: QPCMap) => [DecodedValueMap<QPCMap>, SetQuery<QPCMap>];
export default useQueryParams;
