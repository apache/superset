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
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ReactNode } from 'react';
import configureStore from 'redux-mock-store';
import { usePermissions } from './usePermissions';

const mockStore = configureStore([]);

const rolesWithAllPerms = {
  Admin: [
    ['can_csv', 'Superset'],
    ['can_export_data', 'Superset'],
    ['can_export_image', 'Superset'],
    ['can_copy_clipboard', 'Superset'],
    ['can_explore', 'Superset'],
  ],
};

const rolesWithoutExportPerms = {
  Gamma: [
    ['can_explore', 'Superset'],
    ['can_copy_clipboard', 'Superset'],
  ],
};

const rolesWithLegacyCsvOnly = {
  CustomRole: [
    ['can_csv', 'Superset'],
    ['can_explore', 'Superset'],
  ],
};

function createWrapper(roles: Record<string, string[][]>) {
  const store = mockStore({ user: { roles } });
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isFeatureEnabled } = require('@superset-ui/core');

test('returns canExportData true when user has can_export_data', () => {
  isFeatureEnabled.mockReturnValue(true);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithAllPerms),
  });
  expect(result.current.canExportData).toBe(true);
});

test('returns canExportImage true when user has can_export_image', () => {
  isFeatureEnabled.mockReturnValue(true);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithAllPerms),
  });
  expect(result.current.canExportImage).toBe(true);
});

test('returns canCopyClipboard true when user has can_copy_clipboard', () => {
  isFeatureEnabled.mockReturnValue(true);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithAllPerms),
  });
  expect(result.current.canCopyClipboard).toBe(true);
});

test('returns canExportData false when user lacks can_export_data', () => {
  isFeatureEnabled.mockReturnValue(true);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithoutExportPerms),
  });
  expect(result.current.canExportData).toBe(false);
});

test('returns canExportImage false when user lacks can_export_image', () => {
  isFeatureEnabled.mockReturnValue(true);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithoutExportPerms),
  });
  expect(result.current.canExportImage).toBe(false);
});

test('canDownload uses can_export_data when GRANULAR_EXPORT_CONTROLS enabled', () => {
  isFeatureEnabled.mockReturnValue(true);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithAllPerms),
  });
  expect(result.current.canDownload).toBe(true);
});

test('canDownload uses can_csv when GRANULAR_EXPORT_CONTROLS disabled', () => {
  isFeatureEnabled.mockReturnValue(false);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithLegacyCsvOnly),
  });
  expect(result.current.canDownload).toBe(true);
});

test('canDownload false when GRANULAR_EXPORT_CONTROLS enabled but no can_export_data', () => {
  isFeatureEnabled.mockReturnValue(true);
  const { result } = renderHook(() => usePermissions(), {
    wrapper: createWrapper(rolesWithoutExportPerms),
  });
  expect(result.current.canDownload).toBe(false);
});
