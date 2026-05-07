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
import { renderHook } from '@testing-library/react-hooks';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import { act } from 'spec/helpers/testing-library';

const history = createMemoryHistory({
  initialEntries: ['/dashboard'],
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Router history={history}>{children}</Router>
);

describe('useUnsavedChangesPrompt', () => {
  it('should not show modal initially', () => {
    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave: jest.fn(),
        }),
      { wrapper },
    );

    expect(result.current.showModal).toBe(false);
  });

  it('should block navigation and show modal if there are unsaved changes', () => {
    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave: jest.fn(),
        }),
      { wrapper },
    );

    // Simulate blocked navigation
    act(() => {
      const unblock = history.block((tx: any) => tx);
      unblock();
      history.push('/another-page');
    });

    expect(result.current.showModal).toBe(true);
  });

  it('should trigger onSave and hide modal on handleSaveAndCloseModal', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSaveAndCloseModal();
    });

    expect(onSave).toHaveBeenCalled();
    expect(result.current.showModal).toBe(false);
  });

  it('should trigger manual save and not show modal again', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave,
        }),
      { wrapper },
    );

    act(() => {
      result.current.triggerManualSave();
    });

    expect(onSave).toHaveBeenCalled();
    expect(result.current.showModal).toBe(false);
  });

  it('should close modal when handleConfirmNavigation is called', () => {
    const onSave = jest.fn();

    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave,
        }),
      { wrapper },
    );

    // First, trigger navigation to show the modal
    act(() => {
      const unblock = history.block((tx: any) => tx);
      unblock();
      history.push('/another-page');
    });

    expect(result.current.showModal).toBe(true);

    // Then call handleConfirmNavigation to discard changes
    act(() => {
      result.current.handleConfirmNavigation();
    });

    expect(result.current.showModal).toBe(false);
  });
});

test('should preserve pathname and state when confirming navigation', () => {
  const onSave = jest.fn();
  const history = createMemoryHistory();
  const wrapper = ({ children }: any) => (
    <Router history={history}>{children}</Router>
  );

  const locationState = { fromDashboard: true, dashboardId: 123 };
  const pathname = '/another-page';

  const { result } = renderHook(
    () => useUnsavedChangesPrompt({ hasUnsavedChanges: true, onSave }),
    { wrapper },
  );

  const pushSpy = jest.spyOn(history, 'push');

  // Simulate a blocked navigation (the hook sets up history.block internally)
  act(() => {
    history.push(pathname, locationState);
  });

  // Modal should now be visible
  expect(result.current.showModal).toBe(true);

  // Confirm navigation
  act(() => {
    result.current.handleConfirmNavigation();
  });

  // Modal should close
  expect(result.current.showModal).toBe(false);

  // Verify correct call with pathname and state preserved
  expect(pushSpy).toHaveBeenCalledWith(pathname, locationState);

  pushSpy.mockRestore();
});
