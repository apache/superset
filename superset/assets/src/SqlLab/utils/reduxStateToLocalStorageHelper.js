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
import { LOCALSTORAGE_MAX_QUERY_AGE_MS } from '../constants';

const PERSISTENT_QUERY_EDITOR_KEYS = new Set([
  'remoteId',
  'autorun',
  'dbId',
  'height',
  'id',
  'latestQueryId',
  'northPercent',
  'queryLimit',
  'schema',
  'selectedText',
  'southPercent',
  'sql',
  'templateParams',
  'title',
]);

export function emptyQueryResults(queries) {
  return Object.keys(queries).reduce((accu, key) => {
    const { startDttm, results } = queries[key];
    const query = {
      ...queries[key],
      results:
        Date.now() - startDttm > LOCALSTORAGE_MAX_QUERY_AGE_MS ? {} : results,
    };

    const updatedQueries = {
      ...accu,
      [key]: query,
    };
    return updatedQueries;
  }, {});
}

export function clearQueryEditors(queryEditors) {
  return queryEditors.map(editor =>
    // only return selected keys
    Object.keys(editor)
      .filter(key => PERSISTENT_QUERY_EDITOR_KEYS.has(key))
      .reduce(
        (accumulator, key) => ({
          ...accumulator,
          [key]: editor[key],
        }),
        {},
      ),
  );
}
