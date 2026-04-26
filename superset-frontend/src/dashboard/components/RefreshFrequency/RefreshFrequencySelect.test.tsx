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
import {
  getRefreshWarningMessage,
  validateRefreshFrequency,
} from './RefreshFrequencySelect';

test('validateRefreshFrequency treats millisecond refreshLimit as seconds', () => {
  const errors = validateRefreshFrequency(5, 10000);

  expect(errors[0]).toContain('10');
});

test('validateRefreshFrequency treats second refreshLimit as seconds', () => {
  const errors = validateRefreshFrequency(5, 10);

  expect(errors[0]).toContain('10');
});

test('getRefreshWarningMessage normalizes refreshLimit', () => {
  expect(getRefreshWarningMessage(5, 10000, 'warn')).toBe('warn');
  expect(getRefreshWarningMessage(5, 10, 'warn')).toBe('warn');
  expect(getRefreshWarningMessage(15, 10000, 'warn')).toBeNull();
});
