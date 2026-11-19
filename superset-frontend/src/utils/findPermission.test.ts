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
import { isFeatureEnabled } from '@superset-ui/core';
import { UserRoles } from 'src/types/bootstrapTypes';
import { canDownloadData, findPermission } from './findPermission';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

test('findPermission for single role', () => {
  expect(findPermission('abc', 'def', { role: [['abc', 'def']] })).toEqual(
    true,
  );

  expect(findPermission('abc', 'def', { role: [['abc', 'de']] })).toEqual(
    false,
  );

  expect(findPermission('abc', 'def', { role: [] })).toEqual(false);
});

test('findPermission for multiple roles', () => {
  expect(
    findPermission('abc', 'def', {
      role1: [
        ['ccc', 'aaa'],
        ['abc', 'def'],
      ],
      role2: [['abc', 'def']],
    }),
  ).toEqual(true);

  expect(
    findPermission('abc', 'def', {
      role1: [['abc', 'def']],
      role2: [['abc', 'dd']],
    }),
  ).toEqual(true);

  expect(
    findPermission('abc', 'def', {
      role1: [['ccc', 'aaa']],
      role2: [['aaa', 'ddd']],
    }),
  ).toEqual(false);

  expect(findPermission('abc', 'def', { role1: [], role2: [] })).toEqual(false);
});

test('handles nonexistent roles', () => {
  expect(findPermission('abc', 'def', null)).toEqual(false);
});

describe('canDownloadData', () => {
  const csvOnly: UserRoles = { role: [['can_csv', 'Superset']] };
  const exportOnly: UserRoles = { role: [['can_export_data', 'Superset']] };
  const both: UserRoles = {
    role: [
      ['can_csv', 'Superset'],
      ['can_export_data', 'Superset'],
    ],
  };
  const neither: UserRoles = { role: [['can_write', 'Chart']] };

  afterEach(() => {
    mockIsFeatureEnabled.mockReset();
  });

  test('checks can_csv when GranularExportControls is off', () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    expect(canDownloadData(csvOnly)).toEqual(true);
    expect(canDownloadData(exportOnly)).toEqual(false);
    expect(canDownloadData(both)).toEqual(true);
    expect(canDownloadData(neither)).toEqual(false);
  });

  test('checks can_export_data only when GranularExportControls is on, matching the backend', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    expect(canDownloadData(exportOnly)).toEqual(true);
    // no can_csv fallback: a can_csv-only user would 403 at the backend, so
    // the button must not show
    expect(canDownloadData(csvOnly)).toEqual(false);
    expect(canDownloadData(both)).toEqual(true);
    expect(canDownloadData(neither)).toEqual(false);
  });

  test('handles nonexistent roles', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    expect(canDownloadData(null)).toEqual(false);
    mockIsFeatureEnabled.mockReturnValue(false);
    expect(canDownloadData(undefined)).toEqual(false);
  });
});
