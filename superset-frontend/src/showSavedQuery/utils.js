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

export function getNestedValue(obj, id, separator = '.') {
  /*
   * Given a nested object and an id, return the nested value.
   *
   * > getNestedValue({a:{b:1}}, 'a.b')
   * < 1
   */
  const index = id.indexOf(separator);
  if (index === -1) {
    return obj[id];
  }
  const name = id.slice(0, index);
  const rest = id.slice(index + separator.length);
  return getNestedValue(obj[name], rest, separator);
}

export function interpolate(str, obj) {
  /*
   * Programmatic template string for interpolation.
   *
   * > interpolate('foo ${a.b}', {a:{b:1}})
   * < "foo 1"
   */
  return str.replace(/\$\{(.+?)\}/g, (match, id) => getNestedValue(obj, id));
}
