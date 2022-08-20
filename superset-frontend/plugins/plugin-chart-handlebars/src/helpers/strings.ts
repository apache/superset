import { isObject, isString, isArray } from './utils';

/**
 * Extract a few characters from a string. Default number of characters is 50.
 *
 * @example
 *      {{excerpt 'Just Wow' 4}}    => 'Just'
 *
 * @param {any} string
 * @param {any} length
 * @returns {string}
 */
export function excerpt(string: any, length?: any) {
  const l = length || 50;

  if (typeof string !== 'string' || typeof l !== 'number') {
    return string;
  }

  if (string.length < l) {
    return string;
  }

  return `${string.slice(0, l)}...`;
}

/**
 * Convert a string to url friendly dash-case string removing special characters.
 *
 * @example
 *      {{sanitize 'JuSt #Wow'}}    => 'just-wow'
 *
 * @param {string} string
 * @returns {string}
 */
export function sanitize(string: string) {
  const str = string.replace(/[^\w\s]/gi, '').trim();

  return str.replace(/\s+/, '-').toLowerCase();
}

/**
 * Replace \n with <br> tags.
 *
 * @example
 *     {{newLineToBr 'newLineToBr helper \n is very \n useful.'}}    => newLineToBr helper <br> is very <br> useful.
 *
 * @param {string} string
 * @returns {string}
 */
export function newLineToBr(string: string) {
  return string.replace(/\r?\n|\r/g, '<br>');
}

/**
 * Capitalize each letter of a string.
 *
 * @example
 *      {{capitalizeEach 'just wow'}}   => 'Just Wow'
 *
 * @param {any} string
 * @returns {string}
 */
export function capitalizeEach(string: any) {
  if (typeof string === 'string') {
    return string.toLowerCase().replace(/\w\S*/g, function (match) {
      return match.charAt(0).toUpperCase() + match.substr(1);
    });
  }

  return string;
}

/**
 * Capitalize the first letter of a string.
 *
 * @example
 *      {{capitalizeFirst 'just wow'}}   => 'Just wow'
 *
 * @param {any} string
 * @returns {string}
 */
export function capitalizeFirst(string: any) {
  if (typeof string === 'string') {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  return string;
}

/**
 * Changes the string to lowercase.
 *
 * @example
 *    {{lowercase 'JUST WOW!!!'}}   => 'just wow!!!'
 *
 * @param {string} param
 * @returns {string}
 */
export function lowercase(param: any) {
  return isString(param) ? param.toLowerCase() : param;
}

/**
 * Changes the string to uppercase.
 *
 * @example
 *    {{uppercase 'just wow!!!'}}   => 'JUST WOW!!!'
 *
 * @param {string} param
 * @returns {string}
 */
export function uppercase(param: any) {
  return isString(param) ? param.toUpperCase() : param;
}

/**
 * Get the first element of a collection/array.
 *
 * @example
 *    var someArray = ['David', 'Miller', 'Jones'];
 *    {{first someArray}}   => 'David'
 *
 * @param {array} collection
 * @returns {string}
 */
export function first(collection: any[]) {
  if (!isArray(collection) || collection.length === 0) {
    return '';
  }

  return collection[0];
}

/**
 * Get the last element of a collection/array.
 *
 * @example
 *    var someArray = ['David', 'Miller', 'Jones'];
 *    {{last someArray}}   => 'Jones'
 *
 * @param {any} collection
 * @returns {string}
 */
export function last(collection: any) {
  if (!isArray(collection) || collection.length === 0) {
    return '';
  }

  return collection[collection.length - 1];
}

/**
 * Concat two or more strings.
 *
 * @example
 *    {{concat 'Hello' ' world' '!!!'}}   => 'Hello world!!!'
 *
 * @param {array} params
 * @returns {string}
 */
export function concat(...params: any[]) {
  // Ignore the object appended by handlebars.
  if (isObject(params[params.length - 1])) {
    params.pop();
  }

  return params.join('');
}

/**
 * Join the elements of an array using a delimeter.
 *
 * @example
 *    var someArray = ['Hands', 'legs', 'feet'];
 *    {{join someArray ' & '}}   => 'Hands & legs & feet'
 *
 * @param  {any} params
 * @param  {string} delimiter
 * @returns {string|boolean}
 */
export function join(params: any, delimiter?: string) {
  let d = delimiter;
  if (!delimiter || isObject(delimiter)) {
    d = '';
  }

  if (!isArray(params)) {
    return false;
  }

  return params.join(d);
}
