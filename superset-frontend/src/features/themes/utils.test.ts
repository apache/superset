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
import { hasConflictingAlgorithm } from './utils';

test('flags a light theme assigned to the dark slot', () => {
  expect(hasConflictingAlgorithm('{"algorithm": "default"}', true)).toBe(true);
  expect(
    hasConflictingAlgorithm('{"algorithm": ["default", "compact"]}', true),
  ).toBe(true);
});

test('flags a dark theme assigned to the light slot', () => {
  expect(hasConflictingAlgorithm('{"algorithm": "dark"}', false)).toBe(true);
});

test('does not flag a theme matching its slot', () => {
  expect(hasConflictingAlgorithm('{"algorithm": "dark"}', true)).toBe(false);
  expect(hasConflictingAlgorithm('{"algorithm": "default"}', false)).toBe(
    false,
  );
  expect(
    hasConflictingAlgorithm('{"algorithm": ["dark", "compact"]}', true),
  ).toBe(false);
});

test('does not flag a theme without a usable algorithm', () => {
  expect(hasConflictingAlgorithm(undefined, true)).toBe(false);
  expect(hasConflictingAlgorithm('{"token": {}}', true)).toBe(false);
  expect(hasConflictingAlgorithm('not json', true)).toBe(false);
});
