export default function parseResponse(apiPromise) {
  return apiPromise.then(apiResponse =>
    // first try to parse as json, and fall back to text (e.g., in the case of HTML stacktrace)
    // cannot fall back to .text() without cloning the response because body is single-use
    apiResponse
      .clone()
      .json()
      .catch(() => /* jsonParseError */ apiResponse.text().then(textPayload => ({ textPayload })))
      .then(maybeJson => ({
        json: maybeJson.textPayload ? undefined : maybeJson,
        response: apiResponse,
        text: maybeJson.textPayload,
      }))
      .then(({ response, json, text }) => {
        if (!response.ok) {
          return Promise.reject({
            error: response.error || (json && json.error) || text || 'An error occurred',
            status: response.status,
            statusText: response.statusText,
          });
        }

        return typeof text === 'undefined' ? { json, response } : { response, text };
      }),
  );
}
