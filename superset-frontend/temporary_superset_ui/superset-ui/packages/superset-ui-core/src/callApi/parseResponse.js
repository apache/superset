const PARSERS = {
  json: response => response.json().then(json => ({ json, response })),
  text: response => response.text().then(text => ({ response, text })),
};

export default function parseResponse(apiPromise, parseMethod = 'json') {
  if (parseMethod === null) return apiPromise;

  const responseParser = PARSERS[parseMethod] || PARSERS.json;

  return apiPromise
    .then(response => {
      if (!response.ok) {
        return Promise.reject({
          error: response.error || 'An error occurred',
          response,
          status: response.status,
          statusText: response.statusText,
        });
      }

      return response;
    })
    .then(responseParser);
}
