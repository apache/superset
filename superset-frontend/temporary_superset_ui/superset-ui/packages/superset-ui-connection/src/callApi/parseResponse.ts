import { ParseMethod, TextResponse, JsonResponse } from '../types';

export default async function parseResponse<T extends ParseMethod = 'json'>(
  apiPromise: Promise<Response>,
  parseMethod?: T,
) {
  type ReturnType = T extends 'raw' | null
    ? Response
    : T extends 'json' | undefined
    ? JsonResponse
    : T extends 'text'
    ? TextResponse
    : never;
  const response = await apiPromise;
  // reject failed HTTP requests with the raw response
  if (!response.ok) {
    return Promise.reject(response);
  }
  if (parseMethod === null || parseMethod === 'raw') {
    return response as ReturnType;
  }
  if (parseMethod === 'text') {
    const text = await response.text();
    const result: TextResponse = {
      response,
      text,
    };
    return result as ReturnType;
  }
  // by default treat this as json
  if (parseMethod === undefined || parseMethod === 'json') {
    const json = await response.json();
    const result: JsonResponse = {
      json,
      response,
    };
    return result as ReturnType;
  }
  throw new Error(`Expected parseResponse=json|text|raw|null, got '${parseMethod}'.`);
}
