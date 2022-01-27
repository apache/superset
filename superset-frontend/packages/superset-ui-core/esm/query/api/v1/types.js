(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};








































/**
 * Superset API error types.
 * Ref: https://github.com/apache/incubator-superset/blob/318e5347bc6f88119725775baa4ab9a398a6f0b0/superset/errors.py#L24
 *
 * TODO: migrate superset-frontend/src/components/ErrorMessage/types.ts over
 */
export let SupersetApiErrorType;






















/**
 * API Error json response from the backend (or fetch API in the frontend).
 * See SIP-40 and SIP-41: https://github.com/apache/incubator-superset/issues/9298
 */(function (SupersetApiErrorType) {SupersetApiErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";SupersetApiErrorType["FRONTEND_CSRF_ERROR"] = "FRONTEND_CSRF_ERROR";SupersetApiErrorType["FRONTEND_NETWORK_ERROR"] = "FRONTEND_NETWORK_ERROR";SupersetApiErrorType["FRONTEND_TIMEOUT_ERROR"] = "FRONTEND_TIMEOUT_ERROR";SupersetApiErrorType["GENERIC_DB_ENGINE_ERROR"] = "GENERIC_DB_ENGINE_ERROR";SupersetApiErrorType["VIZ_GET_DF_ERROR"] = "VIZ_GET_DF_ERROR";SupersetApiErrorType["UNKNOWN_DATASOURCE_TYPE_ERROR"] = "UNKNOWN_DATASOURCE_TYPE_ERROR";SupersetApiErrorType["FAILED_FETCHING_DATASOURCE_INFO_ERROR"] = "FAILED_FETCHING_DATASOURCE_INFO_ERROR";SupersetApiErrorType["TABLE_SECURITY_ACCESS_ERROR"] = "TABLE_SECURITY_ACCESS_ERROR";SupersetApiErrorType["DATASOURCE_SECURITY_ACCESS_ERROR"] = "DATASOURCE_SECURITY_ACCESS_ERROR";SupersetApiErrorType["MISSING_OWNERSHIP_ERROR"] = "MISSING_OWNERSHIP_ERROR";})(SupersetApiErrorType || (SupersetApiErrorType = {}));

















export class SupersetApiError extends Error {










  constructor({
    status,
    statusText,
    message,
    link,
    extra,
    stack,
    error_type: errorType,
    originalError })







  {
    super(message);this.status = void 0;this.statusText = void 0;this.errorType = void 0;this.extra = void 0;this.originalError = void 0;
    const originalErrorStack =
    stack || (
    originalError instanceof Error ? originalError.stack : undefined);
    this.stack =
    originalErrorStack && this.stack ?
    [
    this.stack.split('\n')[0],
    ...originalErrorStack.split('\n').slice(1)].
    join('\n') :
    this.stack;
    this.name = 'SupersetApiError';
    this.errorType = errorType || SupersetApiErrorType.UNKNOWN_ERROR;
    this.extra = extra || {};
    if (link) {
      this.extra.link = link;
    }
    this.status = status;
    this.statusText = statusText;
    this.originalError = originalError;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(SupersetApiError, "SupersetApiError", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/api/v1/types.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();