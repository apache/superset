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
import { JsonObject } from '@superset-ui/core';
import { OVERWRITE_INSPECT_FIELDS } from 'src/dashboard/constants';

const JSON_KEYS = new Set(['json_metadata', 'position_json']);

function extractValue(object: JsonObject, keyPath: string) {
  return keyPath.split('.').reduce((obj: JsonObject, key: string) => {
    const value = obj?.[key];
    return JSON_KEYS.has(key) && value ? JSON.parse(value) : value;
  }, object);
}

export default function getOverwriteItems(prev: JsonObject, next: JsonObject) {
  return OVERWRITE_INSPECT_FIELDS.map(keyPath => ({
    keyPath,
    ...(keyPath.split('.').find(key => JSON_KEYS.has(key))
      ? {
          oldValue:
            JSON.stringify(extractValue(prev, keyPath), null, 2) || '{}',
          newValue:
            JSON.stringify(extractValue(next, keyPath), null, 2) || '{}',
        }
      : {
          oldValue: extractValue(prev, keyPath) || '',
          newValue: extractValue(next, keyPath) || '',
        }),
  })).filter(({ oldValue, newValue }) => oldValue !== newValue);
}
