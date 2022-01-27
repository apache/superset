(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};




















export default async function parseResponse(
apiPromise,
parseMethod)
{







  const response = await apiPromise;
  // reject failed HTTP requests with the raw response
  if (!response.ok) {
    return Promise.reject(response);
  }
  if (parseMethod === null || parseMethod === 'raw') {
    return response;
  }
  if (parseMethod === 'text') {
    const text = await response.text();
    const result = {
      response,
      text };

    return result;
  }
  // by default treat this as json
  if (parseMethod === undefined || parseMethod === 'json') {
    const json = await response.json();
    const result = {
      json,
      response };

    return result;
  }
  throw new Error(
  `Expected parseResponse=json|text|raw|null, got '${parseMethod}'.`);

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(parseResponse, "parseResponse", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/callApi/parseResponse.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();