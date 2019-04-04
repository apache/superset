/**
 * Check if `input` is a ES2015 promise.
 *
 * @param input - Value to be checked.
 *
 * @example
 *
 * import isPromise from 'p-is-promise';
 *
 * isPromise(Promise.resolve('🦄'));
 * //=> true
 */
export default function(input: unknown): input is Promise<unknown>;
