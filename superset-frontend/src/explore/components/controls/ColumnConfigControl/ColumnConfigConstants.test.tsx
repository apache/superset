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

test('should allow commas in D3 format inputs', () => {
  const { options } = SHARED_COLUMN_CONFIG_PROPS.d3NumberFormat;
  const labels = (options ?? []).map((option: { label: unknown }) =>
    String(option.label),
  );
  expect(labels.some((label: string) => label.includes(','))).toBe(true);
});

test('should use defaults from Select token separators', () => {
  expect(
    Object.prototype.hasOwnProperty.call(
      SHARED_COLUMN_CONFIG_PROPS.d3NumberFormat,
      'tokenSeparators',
    ),
  ).toBe(false);
});
