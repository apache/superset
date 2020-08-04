/* global TextDecoder, TextEncoder */
import {concatenateArrayBuffers} from '../javascript-utils/memory-copy-utils';

// GENERAL UTILITIES

// Iterate over async iterator, without resetting iterator if end is not reached
// - forEach does not reset iterator if exiting loop prematurely
//   so that iteration can continue in a second loop
// - It is recommended to use a standard for await as last loop to ensure
//   iterator gets properly reset
// TODO - optimize using sync iteration if argument is an Iterable?
export async function forEach(iterator, visitor) {
  // eslint-disable-next-line
  while (true) {
    const {done, value} = await iterator.next();
    if (done) {
      iterator.return();
      return;
    }
    const cancel = visitor(value);
    if (cancel) {
      return;
    }
  }
}

// Concatenates all data chunks yielded by an async iterator
export async function concatenateAsyncIterator(asyncIterator) {
  let arrayBuffer = new ArrayBuffer();
  let string = '';
  for await (const chunk of asyncIterator) {
    if (typeof chunk === 'string') {
      string += chunk;
    } else {
      arrayBuffer = concatenateArrayBuffers(arrayBuffer, chunk);
    }
  }
  return string || arrayBuffer;
}

// ITERATOR GENERATORS

// TextDecoder iterators
// TextDecoder will keep any partial undecoded bytes between calls to `decode`

export async function* textDecoderAsyncIterator(arrayBufferIterator, options) {
  const textDecoder = new TextDecoder(options);
  for await (const arrayBuffer of arrayBufferIterator) {
    yield typeof arrayBuffer === 'string'
      ? arrayBuffer
      : textDecoder.decode(arrayBuffer, {stream: true});
  }
}

// TextEncoder iterator
// TODO - this is not useful unless min chunk size is given
// TextEncoder will keep any partial undecoded bytes between calls to `encode`
// If iterator does not yield strings, assume arrayBuffer and return unencoded

export async function* textEncoderAsyncIterator(textIterator, options) {
  const textEncoder = new TextEncoder();
  for await (const text of textIterator) {
    yield typeof text === 'string' ? textEncoder.encode(text) : text;
  }
}

// Input: async iterable over strings
// Returns: an async iterable over lines
// See http://2ality.com/2018/04/async-iter-nodejs.html

export async function* lineAsyncIterator(textIterator) {
  let previous = '';
  for await (const textChunk of textIterator) {
    previous += textChunk;
    let eolIndex;
    while ((eolIndex = previous.indexOf('\n')) >= 0) {
      // line includes the EOL
      const line = previous.slice(0, eolIndex + 1);
      previous = previous.slice(eolIndex + 1);
      yield line;
    }
  }

  if (previous.length > 0) {
    yield previous;
  }
}

/**
 * Parameter: async iterable of lines
 * Result: async iterable of numbered lines
 */
// See http://2ality.com/2018/04/async-iter-nodejs.html
// eslint-disable-next-line no-shadow
export async function* numberedLineAsyncIterator(lineIterator) {
  let counter = 1;
  for await (const line of lineIterator) {
    yield {counter, line};
    counter++;
  }
}
