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
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { canOverwriteSlice } from './canOverwriteSlice';

// The viewer's subject ids: subject 7 is them, 8 is a role or group they hold.
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ common: { user_subjects: [7, 8] } })),
}));

// isUserAdmin only recognises a fully-shaped bootstrap user: username,
// permissions and roles must all be present or the type guard rejects it.
const admin = {
  userId: 1,
  username: 'admin',
  permissions: {},
  roles: { Admin: [] },
} as unknown as UserWithPermissionsAndRoles;

const gamma = {
  userId: 2,
  username: 'gamma',
  permissions: {},
  roles: { Gamma: [] },
} as unknown as UserWithPermissionsAndRoles;

test('an admin may act on a chart that has no explicit editors', () => {
  // The regression this guards: every seeded and example chart ships with an
  // empty editors list, so a membership-only check hid the action from
  // everyone, admins included, on a fresh install.
  expect(canOverwriteSlice({ slice: { editors: [] }, user: admin })).toBe(true);
});

test('a non-editor without the admin role may not', () => {
  expect(canOverwriteSlice({ slice: { editors: [] }, user: gamma })).toBe(
    false,
  );
});

test('a subject listed among the editors may, whether by id or object', () => {
  expect(canOverwriteSlice({ slice: { editors: [7] }, user: gamma })).toBe(
    true,
  );
  expect(
    canOverwriteSlice({ slice: { editors: [{ id: 8 }] }, user: gamma }),
  ).toBe(true);
});

test('editorship granted indirectly through extra_editors counts', () => {
  // The server's is_editor unions extra_editors into the editor set, so the
  // UI must too or it hides an action the API would allow.
  expect(
    canOverwriteSlice({
      slice: { editors: [], extra_editors: [7] },
      user: gamma,
    }),
  ).toBe(true);
});

test('a subject that matches neither list may not', () => {
  expect(
    canOverwriteSlice({
      slice: { editors: [99], extra_editors: [98] },
      user: gamma,
    }),
  ).toBe(false);
});

test('the store value alone is sufficient', () => {
  expect(
    canOverwriteSlice({
      slice: { editors: [] },
      user: gamma,
      canOverwrite: true,
    }),
  ).toBe(true);
});

test('an externally managed chart is excluded even from an admin', () => {
  expect(
    canOverwriteSlice({
      slice: { editors: [], is_managed_externally: true },
      user: admin,
      canOverwrite: true,
    }),
  ).toBe(false);
});

test('a missing slice is not modifiable', () => {
  expect(canOverwriteSlice({ slice: undefined, user: admin })).toBe(false);
  expect(canOverwriteSlice({ slice: null, user: admin })).toBe(false);
});
