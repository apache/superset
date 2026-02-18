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

function extractValue(object: JsonObject, keyPath: string): unknown {
  return keyPath.split('.').reduce((obj: JsonObject, key: string) => {
    const value = obj?.[key];
    return JSON_KEYS.has(key) && value ? JSON.parse(value) : value;
  }, object);
}

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export default function getOverwriteItems(prev: JsonObject, next: JsonObject) {
  return OVERWRITE_INSPECT_FIELDS.map(keyPath => {
    const oldValue = serializeValue(extractValue(prev, keyPath));
    const newValue = serializeValue(extractValue(next, keyPath));
    return { keyPath, oldValue, newValue };
  }).filter(({ oldValue, newValue }) => oldValue !== newValue);
}
