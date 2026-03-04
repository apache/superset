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
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@superset-ui/core', () => ({
  ...(await importActual()),
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
  onCancel: vi.fn(),
  onSave: vi.fn(),
};
function setup(overridesProps?: any) {
  return render(<FiltersConfigModal {...mockedProps} {...overridesProps} />, {
    useDnd: true,
    useRedux: true,
    initialState: {
      dashboardLayout: {
        present: {},
        past: [],
        future: [],
      },
    },
  });
}

test('should be a valid react element', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('the form validates required fields', async () => {
  const onSave = vi.fn();
  const { getByRole } = setup({ save: onSave });
  fireEvent.change(getByRole('textbox', { name: 'Description' }), {
    target: { value: 'test name' },
  });
  const saveButton = getByRole('button', { name: 'Save' });
  fireEvent.click(saveButton);
  expect(onSave).toHaveBeenCalledTimes(0);
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('createNewOnOpen', () => {
  test('does not show alert when there is no unsaved filters', async () => {
    const onCancel = vi.fn();
    const { getByRole } = setup({ onCancel, createNewOnOpen: false });
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('shows correct alert message for unsaved filters', async () => {
    const onCancel = vi.fn();
    const { getByRole, getByTestId, findByRole } = setup({
      onCancel,
      createNewOnOpen: false,
    });
    const dropdownButton = getByTestId('new-item-dropdown-button');
    fireEvent.mouseEnter(dropdownButton);
    const addFilterMenuItem = await findByRole('menuitem', {
      name: /add filter/i,
    });
    fireEvent.click(addFilterMenuItem);
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(0);
    expect(getByRole('alert')).toBeInTheDocument();
    expect(getByRole('alert')).toHaveTextContent('There are unsaved changes.');
  });
});
