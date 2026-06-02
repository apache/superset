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
  OWNER_TEXT_LABEL_PROP,
  OWNER_EMAIL_PROP,
} from 'src/features/owners/OwnerSelectLabel';
import { parseSelectedOwners } from './utils';

test('preserves a remaining owner from state when the option cache is partial', () => {
  // Owners A(1) and B(2) were loaded from the dashboard, so their full data
  // lives only in component state (the controlled `value`), not in the
  // AsyncSelect option cache.
  const existingOwners = [
    { id: 1, full_name: 'Alice Adams', email: 'alice@example.com' },
    { id: 2, full_name: 'Bob Brown', email: 'bob@example.com' },
  ];
  // The user removes A; onChange fires with only B, and `options` does not
  // contain B (it was never searched/loaded).
  const selectedOwners = [{ value: 2, label: 'Bob Brown' }];
  const options: never[] = [];

  // Regression: B must keep its real name/email rather than collapsing into a
  // nameless ("undefined undefined") owner.
  expect(parseSelectedOwners(selectedOwners, options, existingOwners)).toEqual([
    { id: 2, full_name: 'Bob Brown', email: 'bob@example.com' },
  ]);
});

test('builds a new owner from the option text label when not already in state', () => {
  const options = [
    {
      value: 3,
      // Real labels are OwnerSelectLabel React elements; a number is used here
      // simply as a non-string ReactNode for the test.
      label: 1,
      [OWNER_TEXT_LABEL_PROP]: 'Carol Clark',
      [OWNER_EMAIL_PROP]: 'carol@example.com',
    },
  ];

  expect(parseSelectedOwners([{ value: 3, label: 1 }], options, [])).toEqual([
    { id: 3, full_name: 'Carol Clark', email: 'carol@example.com' },
  ]);
});

test('leaves email undefined when option is cached but carries no email', () => {
  // The option exists in the cache (so `opt` is defined) but has no
  // OWNER_EMAIL_PROP, exercising the `?? undefined` branch directly.
  const options = [
    {
      value: 6,
      label: 'Dave Doe',
      [OWNER_TEXT_LABEL_PROP]: 'Dave Doe',
      // intentionally no OWNER_EMAIL_PROP
    },
  ];

  expect(
    parseSelectedOwners([{ value: 6, label: 'Dave Doe' }], options, []),
  ).toEqual([{ id: 6, full_name: 'Dave Doe', email: undefined }]);
});

test('falls back to a string label when the option has no text label', () => {
  // No option in the cache => email stays undefined (not an empty string).
  expect(
    parseSelectedOwners([{ value: 4, label: 'Plain Name' }], [], []),
  ).toEqual([{ id: 4, full_name: 'Plain Name', email: undefined }]);
});

test('yields an empty name for a non-string label with no text label', () => {
  expect(parseSelectedOwners([{ value: 5, label: 1 }], [], [])).toEqual([
    { id: 5, full_name: '', email: undefined },
  ]);
});
