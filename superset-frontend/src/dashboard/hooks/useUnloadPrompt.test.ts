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
import { renderHook } from '@testing-library/react';
import { useUnloadPrompt } from './useUnloadPrompt';

test('does not arm the beforeunload listener when there are no unsaved changes', () => {
  const add = jest.spyOn(window, 'addEventListener');
  renderHook(() => useUnloadPrompt(false));
  expect(add).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  add.mockRestore();
});

test('arms the beforeunload listener while there are unsaved changes', () => {
  const add = jest.spyOn(window, 'addEventListener');
  renderHook(() => useUnloadPrompt(true));
  expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  add.mockRestore();
});

test('removes the listener on unmount', () => {
  const remove = jest.spyOn(window, 'removeEventListener');
  const { unmount } = renderHook(() => useUnloadPrompt(true));
  unmount();
  expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  remove.mockRestore();
});

test('removes the listener when changes are saved', () => {
  const remove = jest.spyOn(window, 'removeEventListener');
  const { rerender } = renderHook(
    ({ dirty }: { dirty: boolean }) => useUnloadPrompt(dirty),
    { initialProps: { dirty: true } },
  );
  rerender({ dirty: false });
  expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  remove.mockRestore();
});
