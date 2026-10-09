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

import { SHARED_COLUMN_CONFIG_PROPS } from './constants';

test('should include the comma-separated number format preset', () => {
  const { options } = SHARED_COLUMN_CONFIG_PROPS.d3NumberFormat;

  expect(options).toContainEqual({
    value: ',.0f',
    label: ',.0f (12,345)',
  });
});

test('should not treat commas as D3 format token separators', () => {
  expect(SHARED_COLUMN_CONFIG_PROPS.d3NumberFormat.tokenSeparators).toEqual([
    '\r\n',
    '\n',
    '\t',
    ';',
  ]);
});

test('d3NumberFormat and d3TimeFormat should allow free-text entry', () => {
  expect(SHARED_COLUMN_CONFIG_PROPS.d3NumberFormat.allowNewOptions).toBe(true);
  expect(SHARED_COLUMN_CONFIG_PROPS.d3TimeFormat.allowNewOptions).toBe(true);
});
