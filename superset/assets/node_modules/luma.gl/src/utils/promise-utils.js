/**
 * Converts a function that accepts a node style (err, result) callback
 * as the last argument into a function that takes the same arguments
 * and returns a promise that resolves or rejects with the values provided
 * by the original callback
 * @param {Function} func - function to wrap
 * @return {Function} promisified function
 */
/* eslint-disable no-try-catch */
export function promisify(func) {
  return function promisifiedFunction(...args) {
    return new Promise((resolve, reject) => {
      function callback(error, data) {
        try {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(e);
        }
      }
      func(...args, callback);
    });
  };
}
/* eslint-enable no-try-catch */
