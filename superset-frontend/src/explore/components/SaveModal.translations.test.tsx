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
/**
 * Tests for translation support in the chart Save modal.
 *
 * Verifies that when content localization is enabled:
 * - Locale switcher appears on the chart name field
 * - Translations are included in overwrite/save-as API payloads
 *
 * When content localization is disabled, save modal works as before.
 */
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import SaveModal, { PureSaveModal } from 'src/explore/components/SaveModal';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

jest.mock('@superset-ui/core/components/Select', () => ({
  ...jest.requireActual('@superset-ui/core/components/Select/AsyncSelect'),
  AsyncSelect: ({ onChange }: { onChange: (val: any) => void }) => (
    <input
      data-test="mock-async-select"
      onChange={({ target: { value } }) => onChange({ label: value, value })}
    />
  ),
}));

jest.mock('@superset-ui/core/components/TreeSelect', () => ({
  TreeSelect: ({
    onChange,
    disabled,
  }: {
    onChange: (val: any) => void;
    disabled?: boolean;
  }) => (
    <input
      data-test="mock-tree-select"
      disabled={disabled}
      onChange={({ target: { value } }) => onChange(value)}
    />
  ),
}));

const TestSaveModal = PureSaveModal as any;

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

const initialState = {
  chart: {},
  saveModal: {
    dashboards: [],
    isVisible: true,
  },
  explore: {
    datasource: {},
    slice: {
      slice_id: 1,
      slice_name: 'Test Chart',
      owners: [1],
    },
    alert: null,
  },
  user: {
    userId: 1,
  },
  common: {
    locale: 'en',
  },
};

const defaultProps = {
  addDangerToast: jest.fn(),
  onHide: () => ({}),
  actions: {},
  form_data: { datasource: '107__table', url_params: { foo: 'bar' } },
};

fetchMock.get('glob:*/api/v1/localization/available_locales', {
  result: {
    locales: [
      { code: 'en', name: 'English' },
      { code: 'de', name: 'German' },
      { code: 'fr', name: 'French' },
    ],
    default_locale: 'en',
  },
});

fetchMock.get('glob:*/api/v1/chart/1*', {
  result: {
    slice_name: 'Test Chart',
    translations: { slice_name: { de: 'Test-Diagramm' } },
  },
});

fetchMock.get('glob:*/api/v1/dashboard/*', {
  result: { id: 1, dashboard_title: 'Dashboard', url: '/dash/' },
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

// =============================================================================
// UI behavior: locale switcher visibility
// =============================================================================

test('locale switcher hidden when content localization flag is off', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);
  const store = mockStore(initialState);
  render(<SaveModal {...(defaultProps as any)} />, {
    useRouter: true,
    store,
  });
  expect(
    screen.queryByRole('button', { name: /Locale switcher/i }),
  ).not.toBeInTheDocument();
  mockedIsFeatureEnabled.mockReset();
});

test('locale switcher visible on chart name when content localization flag is on', async () => {
  mockedIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.EnableContentLocalization,
  );
  const store = mockStore(initialState);
  render(<SaveModal {...(defaultProps as any)} />, {
    useRouter: true,
    store,
  });
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /Locale switcher/i }),
    ).toBeInTheDocument();
  });
  mockedIsFeatureEnabled.mockReset();
});

// =============================================================================
// Save behavior: translations in overwrite payload
// =============================================================================

test('overwrite passes translations to updateSlice', async () => {
  mockedIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.EnableContentLocalization,
  );
  const mockUpdateSlice: jest.Mock = jest.fn(() => Promise.resolve({ id: 1 }));
  const myProps = {
    ...defaultProps,
    slice: { slice_id: 1, slice_name: 'Test Chart', owners: [1] },
    actions: {
      setFormData: jest.fn(),
      updateSlice: mockUpdateSlice,
      getSliceDashboards: jest.fn(() => Promise.resolve([])),
      saveSliceFailed: jest.fn(),
    },
    user: { userId: 1 },
    history: { replace: jest.fn() },
    dispatch: jest.fn(),
  };

  const saveModal = new TestSaveModal(myProps);
  saveModal.state = {
    action: 'overwrite',
    newSliceName: 'Test Chart',
    datasetName: 'test',
    translations: { slice_name: { de: 'Test-Diagramm' } },
    isLoading: false,
    tabsData: [],
  };
  saveModal.onHide = jest.fn();

  await saveModal.saveOrOverwrite(false);

  await waitFor(() => {
    expect(mockUpdateSlice).toHaveBeenCalled();
  });
  // 5th arg = translations
  expect(mockUpdateSlice.mock.calls[0][4]).toEqual({
    slice_name: { de: 'Test-Diagramm' },
  });
  mockedIsFeatureEnabled.mockReset();
});

// =============================================================================
// Save behavior: translations in save-as payload
// =============================================================================

test('save-as passes translations to createSlice', async () => {
  mockedIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.EnableContentLocalization,
  );
  const mockCreateSlice: jest.Mock = jest.fn(() => Promise.resolve({ id: 2 }));
  const myProps = {
    ...defaultProps,
    slice: null,
    actions: {
      setFormData: jest.fn(),
      createSlice: mockCreateSlice,
      saveSliceFailed: jest.fn(),
    },
    user: { userId: 1 },
    history: { replace: jest.fn() },
    dispatch: jest.fn(),
  };

  const saveModal = new TestSaveModal(myProps);
  saveModal.state = {
    action: 'saveas',
    newSliceName: 'New Chart',
    datasetName: 'test',
    translations: { slice_name: { fr: 'Nouveau graphique' } },
    isLoading: false,
    tabsData: [],
  };
  saveModal.onHide = jest.fn();

  await saveModal.saveOrOverwrite(false);

  await waitFor(() => {
    expect(mockCreateSlice).toHaveBeenCalled();
  });
  // 4th arg = translations (createSlice has: sliceName, dashboards, addedToDashboard, translations)
  expect(mockCreateSlice.mock.calls[0][3]).toEqual({
    slice_name: { fr: 'Nouveau graphique' },
  });
  mockedIsFeatureEnabled.mockReset();
});

// =============================================================================
// Save behavior: no translations when flag off
// =============================================================================

test('save without localization flag passes no translations', async () => {
  mockedIsFeatureEnabled.mockReturnValue(false);
  const mockUpdateSlice: jest.Mock = jest.fn(() => Promise.resolve({ id: 1 }));
  const myProps = {
    ...defaultProps,
    slice: { slice_id: 1, slice_name: 'Test Chart', owners: [1] },
    actions: {
      setFormData: jest.fn(),
      updateSlice: mockUpdateSlice,
      getSliceDashboards: jest.fn(() => Promise.resolve([])),
      saveSliceFailed: jest.fn(),
    },
    user: { userId: 1 },
    history: { replace: jest.fn() },
    dispatch: jest.fn(),
  };

  const saveModal = new TestSaveModal(myProps);
  saveModal.state = {
    action: 'overwrite',
    newSliceName: 'Test Chart',
    datasetName: 'test',
    translations: {},
    isLoading: false,
    tabsData: [],
  };
  saveModal.onHide = jest.fn();

  await saveModal.saveOrOverwrite(false);

  await waitFor(() => {
    expect(mockUpdateSlice).toHaveBeenCalled();
  });
  // No translations arg (5th arg is undefined)
  expect(mockUpdateSlice.mock.calls[0][4]).toBeUndefined();
  mockedIsFeatureEnabled.mockReset();
});
