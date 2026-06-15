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
import { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouter } from '@tanstack/react-router';
import { StandaloneRouter } from 'src/router/StandaloneRouter';
import { useUnsavedChangesPrompt } from '.';

const wrapper = ({ children }: { children: ReactNode }) => (
  <StandaloneRouter initialEntries={['/dashboard']}>
    {children}
  </StandaloneRouter>
);

const setup = async ({ onSave = jest.fn() }: { onSave?: jest.Mock } = {}) => {
  const utils = renderHook(
    () => ({
      prompt: useUnsavedChangesPrompt({
        hasUnsavedChanges: true,
        onSave,
      }),
      router: useRouter(),
    }),
    { wrapper },
  );
  // the router mounts asynchronously before rendering its children
  await waitFor(() => expect(utils.result.current).toBeTruthy());
  return utils;
};

test('should not show modal initially', async () => {
  const { result } = await setup();

  expect(result.current.prompt.showModal).toBe(false);
});

test('should block navigation and show modal if there are unsaved changes', async () => {
  const { result } = await setup();

  await act(async () => {
    result.current.router.history.push('/another-page');
  });

  await waitFor(() => expect(result.current.prompt.showModal).toBe(true));
  expect(result.current.router.state.location.pathname).toBe('/dashboard');
});

test('should trigger onSave and hide modal on handleSaveAndCloseModal', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const { result } = await setup({ onSave });

  await act(async () => {
    await result.current.prompt.handleSaveAndCloseModal();
  });

  expect(onSave).toHaveBeenCalled();
  expect(result.current.prompt.showModal).toBe(false);
});

test('should trigger manual save and not show modal again', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const { result } = await setup({ onSave });

  act(() => {
    result.current.prompt.triggerManualSave();
  });

  expect(onSave).toHaveBeenCalled();
  expect(result.current.prompt.showModal).toBe(false);
});

test('should close modal when handleConfirmNavigation is called', async () => {
  const { result } = await setup();

  // First, trigger navigation to show the modal
  await act(async () => {
    result.current.router.history.push('/another-page');
  });

  await waitFor(() => expect(result.current.prompt.showModal).toBe(true));

  // Then call handleConfirmNavigation to discard changes
  await act(async () => {
    result.current.prompt.handleConfirmNavigation();
  });

  expect(result.current.prompt.showModal).toBe(false);
});

test('should preserve pathname, search, and state when confirming navigation', async () => {
  const { result } = await setup();

  const locationState = { fromDashboard: true, dashboardId: 123 };
  const pathname = '/another-page';
  const search = '?slice_id=42&foo=bar';

  // Simulate a blocked navigation (the hook sets up a blocker internally)
  await act(async () => {
    result.current.router.history.push(`${pathname}${search}`, locationState);
  });

  // Modal should now be visible
  await waitFor(() => expect(result.current.prompt.showModal).toBe(true));

  // Confirm navigation
  await act(async () => {
    result.current.prompt.handleConfirmNavigation();
  });

  // Modal should close
  expect(result.current.prompt.showModal).toBe(false);

  // Verify the blocked navigation resumed with pathname, search, and state
  await waitFor(() =>
    expect(result.current.router.state.location.pathname).toBe(pathname),
  );
  expect(result.current.router.state.location.search).toEqual({
    slice_id: '42',
    foo: 'bar',
  });
  expect(result.current.router.state.location.state).toMatchObject(
    locationState,
  );
});

test('should discard the blocked navigation when modal is dismissed', async () => {
  const { result } = await setup();

  await act(async () => {
    result.current.router.history.push('/another-page');
  });

  await waitFor(() => expect(result.current.prompt.showModal).toBe(true));

  // Dismiss the modal without confirming
  await act(async () => {
    result.current.prompt.setShowModal(false);
  });

  expect(result.current.prompt.showModal).toBe(false);
  expect(result.current.router.state.location.pathname).toBe('/dashboard');
});
