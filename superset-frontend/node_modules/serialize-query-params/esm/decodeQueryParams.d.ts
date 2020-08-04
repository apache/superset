import { DecodedValueMap, QueryParamConfigMap, EncodedValueMap } from './types';
/**
 * Convert the values in query to strings via the encode functions configured
 * in paramConfigMap
 *
 * @param paramConfigMap Map from query name to { encode, decode } config
 * @param query Query updates mapping param name to decoded value
 */
export declare function decodeQueryParams<QPCMap extends QueryParamConfigMap>(paramConfigMap: QPCMap, encodedQuery: Partial<EncodedValueMap<QPCMap>>): Partial<DecodedValueMap<QPCMap>>;
