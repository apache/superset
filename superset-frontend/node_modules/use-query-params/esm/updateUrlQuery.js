import { updateLocation, updateInLocation, } from 'serialize-query-params';
/**
 * Updates the URL to match the specified query changes.
 * If replaceIn or pushIn are used as the updateType, then parameters
 * not specified in queryReplacements are retained. If replace or push
 * are used, only the values in queryReplacements will be available.
 */
export function updateUrlQuery(queryReplacements, location, history, updateType) {
    if (updateType === void 0) { updateType = 'replaceIn'; }
    switch (updateType) {
        case 'replaceIn':
            history.replace(updateInLocation(queryReplacements, location));
            break;
        case 'pushIn':
            history.push(updateInLocation(queryReplacements, location));
            break;
        case 'replace':
            history.replace(updateLocation(queryReplacements, location));
            break;
        case 'push':
            history.push(updateLocation(queryReplacements, location));
            break;
        default:
    }
}
export default updateUrlQuery;
