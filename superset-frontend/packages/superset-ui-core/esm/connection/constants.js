(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















export const DEFAULT_BASE_URL = 'http://localhost';

// HTTP status codes
export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_NOT_MODIFIED = 304;

// Namespace for Cache API
export const CACHE_AVAILABLE = ('caches' in window);
export const CACHE_KEY = '@SUPERSET-UI/CONNECTION';

export const DEFAULT_FETCH_RETRY_OPTIONS = {
  retries: 3,
  retryDelay: 1000,
  retryOn: [503] };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DEFAULT_BASE_URL, "DEFAULT_BASE_URL", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/constants.ts");reactHotLoader.register(HTTP_STATUS_OK, "HTTP_STATUS_OK", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/constants.ts");reactHotLoader.register(HTTP_STATUS_NOT_MODIFIED, "HTTP_STATUS_NOT_MODIFIED", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/constants.ts");reactHotLoader.register(CACHE_AVAILABLE, "CACHE_AVAILABLE", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/constants.ts");reactHotLoader.register(CACHE_KEY, "CACHE_KEY", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/constants.ts");reactHotLoader.register(DEFAULT_FETCH_RETRY_OPTIONS, "DEFAULT_FETCH_RETRY_OPTIONS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/constants.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();