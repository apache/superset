// Forked from github AnthumChris/fetch-progress-indicators under MIT license
/* global Response, ReadableStream */

// Intercepts the Response stream and creates a new Response
export default async function fetchProgress(
  response,
  onProgress,
  onDone = () => {},
  onError = () => {}
) {
  response = await response;
  if (!response.ok) {
    // ERROR checking needs to be done separately
    return response;
  }
  if (!response.body) {
    // 'ReadableStream not yet supported in this browser.
    return response;
  }
  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength && parseInt(contentLength, 10);
  if (!(contentLength > 0)) {
    return response;
  }
  // Currently override only implemented in browser
  if (typeof ReadableStream === 'undefined') {
    return response;
  }

  // Create a new stream that invisbly wraps original stream
  const progressStream = new ReadableStream({
    start(controller) {
      const reader = response.body.getReader();
      read(controller, reader, 0, totalBytes, onProgress, onDone, onError);
    }
  });

  return new Response(progressStream);
}

// Forward to original streams controller
// TODO - this causes a crazy deep "async stack"... rewrite as async iterator?
// eslint-disable-next-line max-params
async function read(controller, reader, loadedBytes, totalBytes, onProgress, onDone, onError) {
  try {
    const {done, value} = await reader.read();
    if (done) {
      onDone();
      controller.close();
      return;
    }
    loadedBytes += value.byteLength;
    const percent = Math.round((loadedBytes / totalBytes) * 100);
    onProgress(percent, {loadedBytes, totalBytes});
    controller.enqueue(value);
    await read(controller, reader, loadedBytes, totalBytes, onProgress, onDone, onError);
  } catch (error) {
    controller.error(error);
    onError(error);
  }
}
