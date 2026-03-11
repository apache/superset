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
import { fireEvent, render, waitFor } from '@superset-ui/core/spec';
import { Button } from '../Button';
import { ConfirmStatusChange } from '.';
import type { ConfirmStatusChangeProps } from './types';

const mockedProps: Omit<ConfirmStatusChangeProps, 'children'> = {
  title: 'please confirm',
  description: 'are you sure?',
  onConfirm: jest.fn(),
};

test('renders children with showConfirm function', () => {
  const childrenSpy = jest.fn().mockReturnValue(<div>test content</div>);

  render(
    <ConfirmStatusChange {...mockedProps}>{childrenSpy}</ConfirmStatusChange>,
  );

  expect(childrenSpy).toHaveBeenCalledWith(expect.any(Function));
});

test('opens modal when showConfirm is called', () => {
  const { getByTestId } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => <Button data-test="trigger" onClick={confirm} />}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  expect(getByTestId(`${mockedProps.title}-modal`)).toBeInTheDocument();
});

test('stores and passes arguments to onConfirm callback', async () => {
  const testArgs = ['arg1', { data: 'test' }, 42];
  const { getByTestId, getByRole } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <Button data-test="trigger" onClick={() => confirm(...testArgs)} />
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  const confirmInput = getByTestId('delete-modal-input');
  fireEvent.change(confirmInput, { target: { value: 'DELETE' } });

  const confirmButton = getByRole('button', { name: 'Delete' });
  fireEvent.click(confirmButton);

  await waitFor(() => expect(mockedProps.onConfirm).toHaveBeenCalledTimes(1));
  expect(mockedProps.onConfirm).toHaveBeenCalledWith(...testArgs);
});

test('calls preventDefault on event-like arguments', () => {
  const mockEvent = {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  };

  const { getByTestId } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <Button data-test="trigger" onClick={() => confirm(mockEvent)} />
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  expect(mockEvent.preventDefault).toHaveBeenCalled();
  expect(mockEvent.stopPropagation).toHaveBeenCalled();
});

test('skips event handling on non-event arguments', () => {
  const regularArg = { someData: 'value' };
  const mockFunc = jest.fn();

  const { getByTestId } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <Button
          data-test="trigger"
          onClick={() => confirm(regularArg, mockFunc)}
        />
      )}
    </ConfirmStatusChange>,
  );

  // Should not throw when processing non-event arguments
  expect(() => {
    fireEvent.click(getByTestId('trigger'));
  }).not.toThrow();

  expect(getByTestId(`${mockedProps.title}-modal`)).toBeInTheDocument();
});

test('ignores null and undefined arguments', () => {
  const { getByTestId } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <Button
          data-test="trigger"
          onClick={() => confirm(null, undefined, 'valid')}
        />
      )}
    </ConfirmStatusChange>,
  );

  expect(() => {
    fireEvent.click(getByTestId('trigger'));
  }).not.toThrow();

  expect(getByTestId(`${mockedProps.title}-modal`)).toBeInTheDocument();
});

test('handles partial event objects gracefully', () => {
  const partialEvent1 = { preventDefault: jest.fn() }; // Only preventDefault
  const partialEvent2 = { stopPropagation: jest.fn() }; // Only stopPropagation

  const { getByTestId } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <Button
          data-test="trigger"
          onClick={() => confirm(partialEvent1, partialEvent2)}
        />
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  expect(partialEvent1.preventDefault).toHaveBeenCalled();
  expect(partialEvent2.stopPropagation).toHaveBeenCalled();
  expect(getByTestId(`${mockedProps.title}-modal`)).toBeInTheDocument();
});

test('closes modal when onHide is called', () => {
  const { getByTestId, getByRole } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => <Button data-test="trigger" onClick={confirm} />}
    </ConfirmStatusChange>,
  );

  // Open modal
  fireEvent.click(getByTestId('trigger'));
  const modal = getByTestId(`${mockedProps.title}-modal`);
  expect(modal).toBeInTheDocument();
  expect(modal).toBeVisible();

  // Close modal
  const cancelButton = getByRole('button', { name: 'Cancel' });
  fireEvent.click(cancelButton);

  // Modal should be hidden (not visible)
  expect(modal).not.toBeVisible();
});
