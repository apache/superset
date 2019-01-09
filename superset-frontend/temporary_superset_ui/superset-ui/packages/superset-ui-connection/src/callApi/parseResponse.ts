import JSONbig from 'json-bigint';
import { ParseMethod, SupersetClientResponse } from '../types';

function rejectIfNotOkay(response: Response): Promise<Response> {
  if (!response.ok) return Promise.reject<Response>(response);

  return Promise.resolve<Response>(response);
}

function parseJson(text: string): any {
  try {
    return JSONbig.parse(text);
  } catch (e) {
    // if JSONbig.parse fails, it throws an object (not a proper Error), so let's re-wrap the message.
    throw new Error(e.message);
  }
}

export default function parseResponse(
  apiPromise: Promise<Response>,
  parseMethod: ParseMethod = 'json',
): Promise<SupersetClientResponse> {
  const checkedPromise = apiPromise.then(rejectIfNotOkay);

  if (parseMethod === null) {
    return apiPromise.then(rejectIfNotOkay);
  } else if (parseMethod === 'text') {
    return checkedPromise.then(response => response.text().then(text => ({ response, text })));
  } else if (parseMethod === 'json') {
    return checkedPromise.then(response =>
      response.text().then(text => ({ json: parseJson(text), response })),
    );
  }

  throw new Error(`Expected parseResponse=null|json|text, got '${parseMethod}'.`);
}
