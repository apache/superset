import { EncodedQueryWithNulls } from 'serialize-query-params';
import { PushReplaceHistory, UrlUpdateType } from './types';
/**
 * Updates the URL to match the specified query changes.
 * If replaceIn or pushIn are used as the updateType, then parameters
 * not specified in queryReplacements are retained. If replace or push
 * are used, only the values in queryReplacements will be available.
 */
export declare function updateUrlQuery(queryReplacements: EncodedQueryWithNulls, location: Location, history: PushReplaceHistory, updateType?: UrlUpdateType): void;
export default updateUrlQuery;
