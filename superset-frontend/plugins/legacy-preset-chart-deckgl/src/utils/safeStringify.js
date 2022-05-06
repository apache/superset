/* eslint-disable consistent-return */
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
 * A Stringify function that will not crash when it runs into circular JSON references,
 * unlike JSON.stringify. Any circular references are simply omitted, as if there had
 * been no data present
 * @param object any JSON object to be stringified
 */

// eslint-disable-next-line import/prefer-default-export
export function safeStringify(object) {
  const cache = new Set();

  return JSON.stringify(object, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        // We've seen this object before
        try {
          // Quick deep copy to duplicate if this is a repeat rather than a circle.
          return JSON.parse(JSON.stringify(value));
        } catch (error) {
          // Discard key if value cannot be duplicated.
          return;
        }
      }
      // Store the value in our cache.
      cache.add(value);
    }

    return value;
  });
}
