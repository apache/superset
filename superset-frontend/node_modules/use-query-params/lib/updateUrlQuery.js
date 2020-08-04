"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var serialize_query_params_1 = require("serialize-query-params");
/**
 * Updates the URL to match the specified query changes.
 * If replaceIn or pushIn are used as the updateType, then parameters
 * not specified in queryReplacements are retained. If replace or push
 * are used, only the values in queryReplacements will be available.
 */
function updateUrlQuery(queryReplacements, location, history, updateType) {
    if (updateType === void 0) { updateType = 'replaceIn'; }
    switch (updateType) {
        case 'replaceIn':
            history.replace(serialize_query_params_1.updateInLocation(queryReplacements, location));
            break;
        case 'pushIn':
            history.push(serialize_query_params_1.updateInLocation(queryReplacements, location));
            break;
        case 'replace':
            history.replace(serialize_query_params_1.updateLocation(queryReplacements, location));
            break;
        case 'push':
            history.push(serialize_query_params_1.updateLocation(queryReplacements, location));
            break;
        default:
    }
}
exports.updateUrlQuery = updateUrlQuery;
exports.default = updateUrlQuery;
