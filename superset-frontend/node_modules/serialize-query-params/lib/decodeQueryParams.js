"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Convert the values in query to strings via the encode functions configured
 * in paramConfigMap
 *
 * @param paramConfigMap Map from query name to { encode, decode } config
 * @param query Query updates mapping param name to decoded value
 */
function decodeQueryParams(paramConfigMap, encodedQuery) {
    var decodedQuery = {};
    var paramNames = Object.keys(encodedQuery);
    for (var _i = 0, paramNames_1 = paramNames; _i < paramNames_1.length; _i++) {
        var paramName = paramNames_1[_i];
        var encodedValue = encodedQuery[paramName];
        if (encodedValue == null) {
            decodedQuery[paramName] = undefined;
            continue;
        }
        if (!paramConfigMap[paramName]) {
            if (process.env.NODE_ENV === 'development') {
                console.warn("Passing through parameter " + paramName + " during decoding since it was not configured.");
            }
            // NOTE: we could just not include it, but it is probably convenient to have
            // it default to be a string type.
            decodedQuery[paramName] = encodedValue;
        }
        else {
            decodedQuery[paramName] = paramConfigMap[paramName].decode(encodedValue);
        }
    }
    return decodedQuery;
}
exports.decodeQueryParams = decodeQueryParams;
