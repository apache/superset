/**
 * Check if param is a function.
 *
 * @param {any} thing
 * @returns {boolean}
 */
export function isFunction(thing: any) {
  return typeof thing === 'function';
}

/**
 * Check if param is a string.
 *
 * @param {any} thing
 * @returns {boolean}
 */
export function isString(thing: any) {
  return typeof thing === 'string';
}

/**
 * Check if param is undefined.
 *
 * @param {any} thing
 * @returns {boolean}
 */
export function isUndefined(thing: any) {
  return typeof thing === 'undefined';
}

/**
 * Check if param is not undefined.
 *
 * @param {any} thing
 * @returns {boolean}
 */
export function isDefined(thing: any) {
  return !isUndefined(thing);
}

/**
 * Check if param is an object.
 *
 * @param {any} thing
 * @returns {boolean}
 */
export function isObject(thing: any) {
  return typeof thing === 'object';
}

/**
 * Check if param is an array.
 *
 * @param {any} thing
 * @returns {boolean}
 */
export function isArray(thing: any) {
  return Object.prototype.toString.call(thing) === '[object Array]';
}

/**
 * Check if the value is numeric.
 *
 * @param {any} thing
 * @returns {boolean}
 */
export function isNumeric(thing: any) {
  return !Number.isNaN(parseFloat(thing)) && Number.isFinite(thing);
}
