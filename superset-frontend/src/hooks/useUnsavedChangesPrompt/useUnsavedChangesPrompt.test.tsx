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
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import { useUnsavedChangesPrompt } from '.';

let history = createMemoryHistory({
  initialEntries: ['/dashboard'],
});

beforeEach(() => {
  history = createMemoryHistory({ initialEntries: ['/dashboard'] });
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Router history={history}>{children}</Router>
);

test('should not show modal initially', () => {
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

test('should block navigation and show modal if there are unsaved changes', () => {
  const { result } = renderHook(
    () =>
      useUnsavedChangesPrompt({
        hasUnsavedChanges: true,
        onSave: jest.fn(),
      }),
    { wrapper },
  );

  // Simulate blocked navigation
  const unblock = history.block((tx: any) => tx);
  unblock();
  history.push('/another-page');

  expect(result.current.showModal).toBe(true);
});

test('should trigger onSave and hide modal on handleSaveAndCloseModal', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);

  const { result } = renderHook(
    () =>
      useUnsavedChangesPrompt({
        hasUnsavedChanges: true,
        onSave,
      }),
    { wrapper },
  );

  await result.current.handleSaveAndCloseModal();

  expect(onSave).toHaveBeenCalled();
  expect(result.current.showModal).toBe(false);
});

test('should trigger manual save and not show modal again', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);

  const { result } = renderHook(
    () =>
      useUnsavedChangesPrompt({
        hasUnsavedChanges: true,
        onSave,
      }),
    { wrapper },
  );

  result.current.triggerManualSave();

  expect(onSave).toHaveBeenCalled();
  expect(result.current.showModal).toBe(false);
});

test('should close modal when handleConfirmNavigation is called', () => {
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
  const unblock = history.block((tx: any) => tx);
  unblock();
  history.push('/another-page');

  expect(result.current.showModal).toBe(true);

  // Then call handleConfirmNavigation to discard changes
  result.current.handleConfirmNavigation();

  expect(result.current.showModal).toBe(false);
});
