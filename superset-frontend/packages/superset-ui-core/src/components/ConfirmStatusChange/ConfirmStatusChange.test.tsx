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

test('forwards the primary button label and style to the opened modal', () => {
  const { getByTestId, getByRole } = render(
    <ConfirmStatusChange
      {...mockedProps}
      primaryButtonName="Retire"
      primaryButtonStyle="primary"
    >
      {confirm => <Button data-test="trigger" onClick={confirm} />}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  const button = getByRole('button', { name: 'Retire' });
  expect(button).toBeInTheDocument();
  expect(button).not.toHaveClass('ant-btn-dangerous');
});

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

test('keeps the confirm button disabled while disablePrimaryButton is set', () => {
  const { getByTestId, getByRole, rerender } = render(
    <ConfirmStatusChange {...mockedProps} disablePrimaryButton>
      {confirm => <Button data-test="trigger" onClick={confirm} />}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));
  fireEvent.change(getByTestId('delete-modal-input'), {
    target: { value: 'DELETE' },
  });

  expect(getByRole('button', { name: 'Delete' })).toBeDisabled();

  rerender(
    <ConfirmStatusChange {...mockedProps} disablePrimaryButton={false}>
      {confirm => <Button data-test="trigger" onClick={confirm} />}
    </ConfirmStatusChange>,
  );

  expect(getByRole('button', { name: 'Delete' })).toBeEnabled();
});

/*
 * `title` and `description` also accept a function, called with whatever
 * the trigger passed. A bulk action's dialog needs it: the selection is only
 * known at the moment the dialog opens, and a dialog that names an outcome
 * from anything else can be wrong about what is actually ticked. Every other
 * test here passes strings, so the function path had no coverage at all.
 */

test('a function description is called with what the trigger passed', () => {
  const { getByTestId, getByText } = render(
    <ConfirmStatusChange
      {...mockedProps}
      description={(rows: { name: string }[]) =>
        `about to remove ${rows.length}: ${rows.map(r => r.name).join(', ')}`
      }
    >
      {confirm => (
        <Button
          data-test="trigger"
          onClick={() => confirm([{ name: 'alpha' }, { name: 'beta' }])}
        />
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  expect(getByText('about to remove 2: alpha, beta')).toBeInTheDocument();
});

test('and so is a function title, from the same arguments', () => {
  // The title names an outcome too. Resolved from anything other than the
  // same arguments, it can contradict the sentence underneath it.
  const { getByTestId, getByText } = render(
    <ConfirmStatusChange
      {...mockedProps}
      title={(rows: { name: string }[]) => `remove ${rows.length} rows?`}
      description={(rows: { name: string }[]) => `that is ${rows.length}`}
    >
      {confirm => (
        <Button
          data-test="trigger"
          onClick={() => confirm([{ name: 'alpha' }])}
        />
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  expect(getByText('remove 1 rows?')).toBeInTheDocument();
  expect(getByText('that is 1')).toBeInTheDocument();
});

test('the arguments are the ones onConfirm will be given', () => {
  // Which is what makes the dialog honest: it describes the selection the
  // confirm handler is about to act on, not a different reading of it.
  const onConfirm = jest.fn();
  const described: unknown[][] = [];
  const { getByTestId, getByRole } = render(
    <ConfirmStatusChange
      {...mockedProps}
      // Recoverable, so the confirm button needs no typed-text step, and
      // named explicitly so this test does not depend on the modal's
      // default label. The subject is the arguments, not the chrome.
      recoverable
      primaryButtonName="Confirm"
      onConfirm={onConfirm}
      description={(...args: unknown[]) => {
        described.push(args);
        return 'go on then';
      }}
    >
      {confirm => (
        <Button data-test="trigger" onClick={() => confirm('a', 'b')} />
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));
  fireEvent.click(getByRole('button', { name: 'Confirm' }));

  expect(onConfirm).toHaveBeenCalledWith('a', 'b');
  expect(described[described.length - 1]).toEqual(['a', 'b']);
});

test('a string description still renders, so existing callers are untouched', () => {
  const { getByTestId, getByText } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => <Button data-test="trigger" onClick={confirm} />}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('trigger'));

  expect(getByText('are you sure?')).toBeInTheDocument();
});
