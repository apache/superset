/* global File, Blob, Response */

const isBoolean = x => typeof x === 'boolean';
const isFunction = x => typeof x === 'function';
const isObject = x => x !== null && typeof x === 'object';

export const isPromise = x => isObject(x) && isFunction(x.then);

export const isIterable = x => x && typeof x[Symbol.iterator] === 'function';

export const isAsyncIterable = x => x && typeof x[Symbol.asyncIterator] === 'function';

export const isIterator = x => x && isFunction(x.next);

export const isFetchResponse = x =>
  (typeof Response !== 'undefined' && x instanceof Response) || (x.arrayBuffer && x.text && x.json);

export const isFile = x => typeof File !== 'undefined' && x instanceof File;
export const isBlob = x => typeof Blob !== 'undefined' && x instanceof Blob;
export const isFileReadable = x => isFile(x) || isBlob(x); // Blob & File are FileReader compatible

export const isWritableDOMStream = x => {
  return isObject(x) && isFunction(x.abort) && isFunction(x.getWriter);
};

export const isReadableDOMStream = x => {
  return (
    isObject(x) &&
    isFunction(x.tee) &&
    isFunction(x.cancel) &&
    isFunction(x.pipeTo) &&
    isFunction(x.getReader)
  );
};

export const isWritableNodeStream = x => {
  return isObject(x) && isFunction(x.end) && isFunction(x.write) && isBoolean(x.writable);
};

export const isReadableNodeStream = x => {
  return isObject(x) && isFunction(x.read) && isFunction(x.pipe) && isBoolean(x.readable);
};

export const isReadableStream = x => isReadableDOMStream(x) || isReadableNodeStream(x);

export const isWritableStream = x => isWritableDOMStream(x) || isWritableNodeStream(x);
