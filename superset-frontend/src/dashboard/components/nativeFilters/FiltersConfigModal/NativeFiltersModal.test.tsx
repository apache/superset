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
import { fireEvent, render } from 'spec/helpers/testing-library';
import FiltersConfigModal from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

jest.mock('@superset-ui/core', () => ({
  // @ts-ignore
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: () => ({
    items: {
      filter_select: {
        value: {
          datasourceCount: 1,
          behaviors: ['NATIVE_FILTER'],
        },
      },
    },
  }),
}));

const mockedProps = {
  isOpen: true,
  initialFilterId: 'NATIVE_FILTER-1',
  createNewOnOpen: true,
  onCancel: jest.fn(),
  onSave: jest.fn(),
};
function setup(overridesProps?: any) {
  return render(<FiltersConfigModal {...mockedProps} {...overridesProps} />, {
    useDnd: true,
    useRedux: true,
  });
}

test('should be a valid react element', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('the form validates required fields', async () => {
  const onSave = jest.fn();
  const { getByRole } = setup({ save: onSave });
  fireEvent.change(getByRole('textbox', { name: 'Description' }), {
    target: { value: 'test name' },
  });
  const saveButton = getByRole('button', { name: 'Save' });
  fireEvent.click(saveButton);
  expect(onSave).toHaveBeenCalledTimes(0);
});

describe('createNewOnOpen', () => {
  test('does not show alert when there is no unsaved filters', async () => {
    const onCancel = jest.fn();
    const { getByRole } = setup({ onCancel, createNewOnOpen: false });
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('shows correct alert message for unsaved filters', async () => {
    const onCancel = jest.fn();
    const { getByRole, getByTestId } = setup({
      onCancel,
      createNewOnOpen: false,
    });
    fireEvent.click(getByTestId('add-new-filter-button'));
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(0);
    expect(getByRole('alert')).toBeInTheDocument();
    expect(getByRole('alert')).toHaveTextContent('There are unsaved changes.');
  });
});
