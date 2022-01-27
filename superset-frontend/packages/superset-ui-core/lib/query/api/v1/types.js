/**
 * Superset API error types.
 * Ref: https://github.com/apache/incubator-superset/blob/318e5347bc6f88119725775baa4ab9a398a6f0b0/superset/errors.py#L24
 *
 * TODO: migrate superset-frontend/src/components/ErrorMessage/types.ts over
 */
export var SupersetApiErrorType;
(function (SupersetApiErrorType) {
    // Generic unknown error
    SupersetApiErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    // Frontend errors
    SupersetApiErrorType["FRONTEND_CSRF_ERROR"] = "FRONTEND_CSRF_ERROR";
    SupersetApiErrorType["FRONTEND_NETWORK_ERROR"] = "FRONTEND_NETWORK_ERROR";
    SupersetApiErrorType["FRONTEND_TIMEOUT_ERROR"] = "FRONTEND_TIMEOUT_ERROR";
    // DB Engine errors,
    SupersetApiErrorType["GENERIC_DB_ENGINE_ERROR"] = "GENERIC_DB_ENGINE_ERROR";
    // Viz errors,
    SupersetApiErrorType["VIZ_GET_DF_ERROR"] = "VIZ_GET_DF_ERROR";
    SupersetApiErrorType["UNKNOWN_DATASOURCE_TYPE_ERROR"] = "UNKNOWN_DATASOURCE_TYPE_ERROR";
    SupersetApiErrorType["FAILED_FETCHING_DATASOURCE_INFO_ERROR"] = "FAILED_FETCHING_DATASOURCE_INFO_ERROR";
    // Security access errors,
    SupersetApiErrorType["TABLE_SECURITY_ACCESS_ERROR"] = "TABLE_SECURITY_ACCESS_ERROR";
    SupersetApiErrorType["DATASOURCE_SECURITY_ACCESS_ERROR"] = "DATASOURCE_SECURITY_ACCESS_ERROR";
    SupersetApiErrorType["MISSING_OWNERSHIP_ERROR"] = "MISSING_OWNERSHIP_ERROR";
})(SupersetApiErrorType || (SupersetApiErrorType = {}));
export class SupersetApiError extends Error {
    status;
    statusText;
    errorType;
    extra;
    originalError;
    constructor({ status, statusText, message, link, extra, stack, error_type: errorType, originalError, }) {
        super(message);
        const originalErrorStack = stack ||
            (originalError instanceof Error ? originalError.stack : undefined);
        this.stack =
            originalErrorStack && this.stack
                ? [
                    this.stack.split('\n')[0],
                    ...originalErrorStack.split('\n').slice(1),
                ].join('\n')
                : this.stack;
        this.name = 'SupersetApiError';
        this.errorType = errorType || SupersetApiErrorType.UNKNOWN_ERROR;
        this.extra = extra || {};
        if (link) {
            this.extra.link = link;
        }
        this.status = status;
        this.statusText = statusText;
        this.originalError = originalError;
    }
}
//# sourceMappingURL=types.js.map