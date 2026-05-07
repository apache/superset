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
  render,
  screen,
  fireEvent,
  act,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { Modal } from '@superset-ui/core/components';
import mockDatasource from 'spec/fixtures/mockDatasource';
import { DatasourceModal } from '.';

const mockedProps = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  onChange: jest.fn(),
  onHide: jest.fn(),
  show: true,
  onDatasourceSave: jest.fn(),
};

beforeEach(() => {
  fetchMock.reset();
  fetchMock.put('glob:*/api/v1/dataset/7?override_columns=*', {});
  fetchMock.get('glob:*/api/v1/dataset/7', { result: {} });
  fetchMock.get('glob:*/api/v1/database/?q=*', { result: [] });
});

afterEach(() => {
  fetchMock.reset();
  jest.clearAllMocks();
});

test('DatasourceModal - should use Modal.useModal hook instead of Modal.confirm directly', () => {
  const useModalSpy = jest.spyOn(Modal, 'useModal');
  const confirmSpy = jest.spyOn(Modal, 'confirm');

  render(<DatasourceModal {...mockedProps} />, { store });

  // Should use the useModal hook
  expect(useModalSpy).toHaveBeenCalled();

  // Should not call Modal.confirm during initial render
  expect(confirmSpy).not.toHaveBeenCalled();

  useModalSpy.mockRestore();
  confirmSpy.mockRestore();
});

test('DatasourceModal - should handle sync columns state without imperative modal updates', async () => {
  // Test that we can successfully click the save button without DOM errors
  // The actual checkbox is only visible when SQL has changed
  render(<DatasourceModal {...mockedProps} />, { store });

  const saveButton = screen.getByTestId('datasource-modal-save');

  // This should not throw any DOM errors
  await act(async () => {
    fireEvent.click(saveButton);
  });

  // Should show confirmation modal
  expect(screen.getByText('Confirm save')).toBeInTheDocument();

  // Should show the confirmation message
  expect(
    screen.getByText('Are you sure you want to save and apply changes?'),
  ).toBeInTheDocument();
});

test('DatasourceModal - should not store modal instance in state', () => {
  // Mock console.warn to catch any warnings about refs or imperatives
  const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

  render(<DatasourceModal {...mockedProps} />, { store });

  // No warnings should be generated about improper React patterns
  const reactWarnings = consoleWarn.mock.calls.filter(call =>
    call.some(
      arg =>
        typeof arg === 'string' &&
        (arg.includes('findDOMNode') ||
          arg.includes('ref') ||
          arg.includes('instance')),
    ),
  );

  expect(reactWarnings).toHaveLength(0);

  consoleWarn.mockRestore();
});
