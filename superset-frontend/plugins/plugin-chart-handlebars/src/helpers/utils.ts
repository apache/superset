/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
