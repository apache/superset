import {default as SyntheticAbortController} from './abortcontroller';

/**
 * Note: the "fetch.Request" default value is available for fetch imported from
 * the "node-fetch" package and not in browsers. This is OK since browsers
 * will be importing umd-polyfill.js from that path "self" is passed the
 * decorator so the default value will not be used (because browsers that define
 * fetch also has Request). One quirky setup where self.fetch exists but
 * self.Request does not is when the "unfetch" minimal fetch polyfill is used
 * on top of IE11; for this case the browser will try to use the fetch.Request
 * default value which in turn will be undefined but then then "if (Request)"
 * will ensure that you get a patched fetch but still no Request (as expected).
 * @param {fetch, Request = fetch.Request}
 * @returns {fetch: abortableFetch, Request: AbortableRequest}
 */
export default function abortableFetchDecorator(patchTargets) {
  if ('function' === typeof patchTargets) {
    patchTargets = {fetch: patchTargets};
  }
  const {
    fetch,
    Request: NativeRequest = fetch.Request,
    AbortController: NativeAbortController = SyntheticAbortController
  } = patchTargets;

  let Request = NativeRequest;
  // Note that the "unfetch" minimal fetch polyfill defines fetch() without
  // defining window.Request, and this polyfill need to work on top of unfetch
  // so the below feature detection is wrapped in if (Request)
  if (Request) {
    // Do feature detecting
    const controller = new NativeAbortController();
    const signal = controller.signal;
    const request = new Request('/', { signal });

    // Browser already supports abortable fetch (like FF v57 and fetch-polyfill)
    if (request.signal) {
      return {fetch, Request};
    }

    Request = function Request(input, init) {
      let request = new NativeRequest(input, init);
      if (init && init.signal) {
        request.signal = init.signal;
      }
      return request;
    };
    Request.prototype = NativeRequest.prototype;
  }

  const realFetch = fetch;
  const abortableFetch = (input, init) => {
    const signal = (Request && Request.prototype.isPrototypeOf(input)) ? input.signal : init ? init.signal : undefined;

    if (signal) {
      let abortError;
      try {
        abortError = new DOMException('Aborted', 'AbortError');
      } catch (err) {
        // IE 11 does not support calling the DOMException constructor, use a
        // regular error object on it instead.
        abortError = new Error('Aborted');
        abortError.name = 'AbortError';
      }

      // Return early if already aborted, thus avoiding making an HTTP request
      if (signal.aborted) {
        return Promise.reject(abortError);
      }

      // Turn an event into a promise, reject it once `abort` is dispatched
      const cancellation = new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(abortError), {once: true});
      });

      // Return the fastest promise (don't need to wait for request to finish)
      return Promise.race([cancellation, realFetch(input, init)]);
    }

    return realFetch(input, init);
  };

  return {fetch: abortableFetch, Request};
}
