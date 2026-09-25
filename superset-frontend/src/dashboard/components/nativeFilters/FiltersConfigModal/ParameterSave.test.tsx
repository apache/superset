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
import { FeatureFlag, Preset } from '@superset-ui/core';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { ParameterFilterPlugin } from 'src/filters/components';
import FiltersConfigModal from './FiltersConfigModal';

class ParamPreset extends Preset {
  constructor() {
    super({
      name: 'Param test preset',
      plugins: [
        new ParameterFilterPlugin().configure({ key: 'filter_parameter' }),
      ],
    });
  }
}

beforeAll(() => {
  new ParamPreset().register();
});

window.featureFlags = {
  [FeatureFlag.DashboardParameters]: true,
};

const defaultState = () => ({
  dashboardInfo: { id: 1 },
  datasources: {},
  charts: {},
  dashboardLayout: { present: {}, past: [], future: [] },
  nativeFilters: {
    filters: {},
  },
});

test('configuring parameter default value and saving', async () => {
  const onSave = jest.fn();
  render(
    <FiltersConfigModal
      isOpen
      createNewOnOpen={false}
      onSave={onSave}
      onCancel={jest.fn()}
      initialFilterId=""
    />,
    {
      initialState: defaultState(),
      useDnd: true,
      useRedux: true,
    },
  );

  // Add parameter
  const addButton = screen.getByTestId('new-item-dropdown-button');
  fireEvent.mouseOver(addButton);
  const paramOption = await screen.findByText('Add parameter');
  fireEvent.click(paramOption);

  // Wait for parameter form to show up
  expect(await screen.findByText('Parameter name')).toBeInTheDocument();

  // Check "Parameter has default value"
  const defaultValueCheckbox = screen.getByRole('checkbox', {
    name: /parameter has default value/i,
  });
  expect(defaultValueCheckbox).not.toBeChecked();

  await userEvent.click(defaultValueCheckbox);
  expect(defaultValueCheckbox).toBeChecked();

  // Find the parameter default value input
  const input = await screen.findByTestId('parameter-text-input');
  expect(input).toBeInTheDocument();

  await userEvent.type(input, 'my_default_val');
  expect(input).toHaveValue('my_default_val');

  // Click Save
  const saveButton = screen.getByRole('button', { name: /^save$/i });
  await userEvent.click(saveButton);

  await waitFor(() => {
    expect(onSave).toHaveBeenCalled();
  });

  const saveCall = onSave.mock.calls[0][0];
  const modifiedFilter = saveCall.filterChanges.modified[0];
  expect(modifiedFilter.defaultDataMask?.filterState?.value).toBe('my_default_val');
  expect(
    modifiedFilter.defaultDataMask?.extraFormData?.parameters?.['New parameter'],
  ).toBe('my_default_val');
});

test('configuring parameter with custom name and default value', async () => {
  const onSave = jest.fn();
  render(
    <FiltersConfigModal
      isOpen
      createNewOnOpen={false}
      onSave={onSave}
      onCancel={jest.fn()}
      initialFilterId=""
    />,
    {
      initialState: defaultState(),
      useDnd: true,
      useRedux: true,
    },
  );

  // Add parameter
  const addButton = screen.getByTestId('new-item-dropdown-button');
  fireEvent.mouseOver(addButton);
  const paramOption = await screen.findByText('Add parameter');
  fireEvent.click(paramOption);

  // Change parameter name
  const nameInput = await screen.findByTestId('filters-config-modal__name-input');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'threshold_val');

  // Check "Parameter has default value"
  const defaultValueCheckbox = screen.getByRole('checkbox', {
    name: /parameter has default value/i,
  });
  await userEvent.click(defaultValueCheckbox);

  // Find the parameter default value input
  const input = await screen.findByTestId('parameter-text-input');
  await userEvent.type(input, '100');

  // Click Save
  const saveButton = screen.getByRole('button', { name: /^save$/i });
  await userEvent.click(saveButton);

  await waitFor(() => {
    expect(onSave).toHaveBeenCalled();
  });

  const saveCall = onSave.mock.calls[0][0];
  const modifiedFilter = saveCall.filterChanges.modified[0];
  expect(modifiedFilter.name).toBe('threshold_val');
  expect(modifiedFilter.defaultDataMask?.filterState?.value).toBe('100');
  expect(
    modifiedFilter.defaultDataMask?.extraFormData?.parameters?.['threshold_val'],
  ).toBe('100');
});

