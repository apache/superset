import {isBrowser, nodeVersion} from '../utils/globals';

export function getStreamIterator(stream) {
  // Hacky test for node version to ensure we don't call bad polyfills
  if (isBrowser || nodeVersion >= 10) {
    // NODE 10+: stream is an asyncIterator
    if (typeof stream[Symbol.asyncIterator] === 'function') {
      return stream;
    }

    // WhatWG: stream is supposed to have a `getIterator` method
    if (typeof stream.getIterator === 'function') {
      return stream.getIterator();
    }
  }

  return isBrowser ? makeBrowserStreamIterator(stream) : makeNodeStreamIterator(stream);
}

// BROWSER IMPLEMENTATION
// See https://jakearchibald.com/2017/async-iterators-and-generators/#making-streams-iterate

async function* makeBrowserStreamIterator(stream) {
  // In the brower, we first need to get a lock on the stream
  const reader = stream.getReader();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Read from the stream
      const {done, value} = await reader.read();
      // Exit if we're done
      if (done) {
        return;
      }
      // Else yield the chunk
      yield value;
    }
  } catch (error) {
    // TODO - examples makes it look like this should always be called,
    // but that generates exceptions so only call it if we do not reach the end
    reader.releaseLock();
  }
}

// NODE <10 IMPLEMENTATION
// See https://github.com/bustle/streaming-iterables, MIT license

async function* makeNodeStreamIterator(stream) {
  // Node createStream will return promises to handle http requests
  stream = await stream;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = stream.read();
    if (data !== null) {
      yield data;
      // eslint-disable-next-line no-continue
      continue;
    }
    if (stream._readableState.ended) {
      return;
    }
    await onceReadable(stream);
  }
}

async function onceReadable(stream) {
  return new Promise(resolve => {
    stream.once('readable', resolve);
  });
}

// TODO - we could add our own polyfill
// const {Readable} = require('stream');
// if (typeof Readable !== 'undefined' && !Readable.prototype[Symbol.asyncIterator]) {
//   Readable.prototype[Symbol.asyncIterator] = function () {
//     return makeNodeStreamIterator(this);
//   }
// }
