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
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import { renderHook } from '@testing-library/react-hooks';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/ui';
import { useConfirmModal } from '.';

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

test('initially returns null ConfirmModal', () => {
  const { result } = renderHook(() => useConfirmModal());

  expect(result.current.ConfirmModal).toBeNull();
});

test('showConfirm creates modal with config', () => {
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Test Title',
    body: 'Test Body',
    onConfirm: jest.fn(),
  });

  expect(result.current.ConfirmModal).not.toBeNull();
});

test('renders modal when showConfirm is called', () => {
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Delete Item',
    body: 'Are you sure you want to delete this item?',
    onConfirm: jest.fn(),
  });

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  expect(screen.getByText('Delete Item')).toBeInTheDocument();
  expect(
    screen.getByText('Are you sure you want to delete this item?'),
  ).toBeInTheDocument();
});

test('calls onConfirm when confirm button is clicked', async () => {
  const onConfirm = jest.fn();
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Confirm',
    body: 'Proceed?',
    onConfirm,
  });

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  await waitFor(() => {
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

test('handles async onConfirm', async () => {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Async Action',
    body: 'This will take some time',
    onConfirm,
  });

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));

  await waitFor(() => {
    expect(onConfirm).toHaveBeenCalled();
  });
});

test('closes modal on cancel', async () => {
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Test',
    body: 'Test',
    onConfirm: jest.fn(),
  });

  expect(result.current.ConfirmModal).not.toBeNull();

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => {
    expect(result.current.ConfirmModal).toBeNull();
  });
});

test('supports custom button text', () => {
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Delete',
    body: 'Remove this?',
    onConfirm: jest.fn(),
    confirmText: 'Remove',
    cancelText: 'Keep',
  });

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
});

test('supports danger button style', () => {
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Delete',
    body: 'This is dangerous',
    onConfirm: jest.fn(),
    confirmButtonStyle: 'danger',
  });

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  const confirmButton = screen.getByRole('button', { name: 'Confirm' });
  expect(confirmButton).toHaveClass('superset-button-danger');
});

test('handles errors in onConfirm gracefully', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  const onConfirm = jest.fn().mockRejectedValue(new Error('Test error'));
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Error Test',
    body: 'This will fail',
    onConfirm,
  });

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));

  await waitFor(() => {
    expect(consoleError).toHaveBeenCalled();
    expect(result.current.ConfirmModal).not.toBeNull(); // Modal stays open on error
  });

  consoleError.mockRestore();
});

test('closes modal after successful confirm', async () => {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useConfirmModal());

  result.current.showConfirm({
    title: 'Success Test',
    body: 'This will succeed',
    onConfirm,
  });

  expect(result.current.ConfirmModal).not.toBeNull();

  renderWithTheme(<>{result.current.ConfirmModal}</>);

  await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));

  await waitFor(() => {
    expect(onConfirm).toHaveBeenCalled();
    expect(result.current.ConfirmModal).toBeNull();
  });
});
