import 'whatwg-fetch';
import { CallApi } from '../types';
/**
 * Fetch an API response and returns the corresponding json.
 *
 * @param {Payload} postPayload payload to send as FormData in a post form
 * @param {Payload} jsonPayload json payload to post, will automatically add Content-Type header
 * @param {string} stringify whether to stringify field values when post as formData
 */
export default function callApi({ body, cache, credentials, fetchRetryOptions, headers, method, mode, postPayload, jsonPayload, redirect, signal, stringify, url: url_, searchParams, }: CallApi): Promise<Response>;
//# sourceMappingURL=callApi.d.ts.map