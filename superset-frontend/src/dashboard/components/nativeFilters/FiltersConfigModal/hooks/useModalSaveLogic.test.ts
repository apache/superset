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
import { act, renderHook } from '@testing-library/react';
import type { FormInstance } from '@superset-ui/core/components';
import { NativeFiltersForm } from '../types';
import { useModalSaveLogic, ModalSaveLogicParams } from './useModalSaveLogic';
import { ItemStateManager } from './useItemStateManager';

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
}));

const buildItemState = (
  overrides: Partial<ItemStateManager> = {},
): ItemStateManager => ({
  changes: { modified: [], deleted: [], reordered: [] },
  newIds: [],
  removedItems: {},
  erroredIds: [],
  orderedIds: [],
  renderedIds: [],
  setChanges: jest.fn(),
  setNewIds: jest.fn(),
  setRemovedItems: jest.fn(),
  setErroredIds: jest.fn(),
  setOrderedIds: jest.fn(),
  setRenderedIds: jest.fn(),
  resetState: jest.fn(),
  addToRendered: jest.fn(),
  ...overrides,
});

const buildParams = (
  overrides: Partial<ModalSaveLogicParams> = {},
): ModalSaveLogicParams => ({
  form: {
    getFieldValue: jest.fn(),
    isFieldsTouched: jest.fn(() => false),
    getFieldsError: jest.fn(() => []),
  } as unknown as FormInstance<NativeFiltersForm>,
  configFormRef: { current: null },
  filterState: buildItemState(),
  customizationState: buildItemState(),
  filterIds: [],
  chartCustomizationIds: [],
  filterConfigMap: {},
  chartCustomizationConfigMap: {},
  initialFilterOrder: [],
  initialCustomizationOrder: [],
  unsavedFiltersIds: [],
  currentItemId: '',
  setActiveItem: jest.fn(),
  onSave: jest.fn(),
  canBeUsedAsDependency: jest.fn(() => true),
  resetForm: jest.fn(),
  ...overrides,
});

test('canSave is false while a filter has validation errors, even with pending changes', () => {
  const params = buildParams({
    filterState: buildItemState({
      erroredIds: ['f1'],
      changes: { modified: ['f1'], deleted: [], reordered: [] },
    }),
  });

  const { result } = renderHook(() => useModalSaveLogic(params));

  expect(result.current.canSave).toBe(false);
});

test.each([false, true])(
  'guards duplicate saves and clears loading after failure=%s',
  async fail => {
    let finish: () => void = () => {};
    const pending = new Promise<void>(resolve => {
      finish = resolve;
    });
    const onSave = jest.fn(async () => {
      await pending;
      if (fail) throw new Error('save failed');
    });
    const params = buildParams({
      form: {
        getFieldValue: jest.fn(),
        isFieldsTouched: jest.fn(() => true),
        getFieldsError: jest.fn(() => []),
        validateFields: jest.fn(async () => ({ filters: {} })),
      } as unknown as FormInstance<NativeFiltersForm>,
      filterState: buildItemState({
        changes: { modified: ['f1'], deleted: [], reordered: [] },
      }),
      onSave,
    });
    const { result } = renderHook(() => useModalSaveLogic(params));
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    await act(async () => {
      first = result.current.handleSave();
      // Same render and tick: state alone cannot prevent this duplicate.
      second = result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(true);
    await act(async () => {
      finish();
      await first;
      await second;
    });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.canSave).toBe(true);
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
  },
);

test('canSave is true once a change exists and no filter has validation errors', () => {
  const params = buildParams({
    filterState: buildItemState({
      changes: { modified: ['f1'], deleted: [], reordered: [] },
    }),
  });

  const { result } = renderHook(() => useModalSaveLogic(params));

  expect(result.current.canSave).toBe(true);
});

test('hasUnsavedChanges is true while a filter removal is still pending', () => {
  const params = buildParams({
    filterState: buildItemState({
      removedItems: { f1: { isPending: true, timerId: 1 } },
    }),
  });

  const { result } = renderHook(() => useModalSaveLogic(params));

  expect(result.current.hasUnsavedChanges).toBe(true);
});

test('hasUnsavedChanges is false when nothing changed and no removal is pending', () => {
  const params = buildParams();

  const { result } = renderHook(() => useModalSaveLogic(params));

  expect(result.current.hasUnsavedChanges).toBe(false);
});

test.each([
  ['keeps the pending changes when the save fails', true],
  ['clears them once the save succeeds', false],
])('%s', async (_name, saveFails) => {
  const resetForm = jest.fn();
  const onSave = jest.fn(async () => {
    if (saveFails) {
      throw new Error('save failed');
    }
  });
  const params = buildParams({
    form: {
      getFieldValue: jest.fn(),
      isFieldsTouched: jest.fn(() => true),
      getFieldsError: jest.fn(() => []),
      validateFields: jest.fn(async () => ({ filters: {} })),
    } as unknown as FormInstance<NativeFiltersForm>,
    filterState: buildItemState({
      changes: { modified: ['f1'], deleted: [], reordered: [] },
    }),
    onSave,
    resetForm,
  });

  const { result } = renderHook(() => useModalSaveLogic(params));
  await act(async () => {
    await result.current.handleSave();
  });

  expect(onSave).toHaveBeenCalledTimes(1);
  // Resetting after a failed save would drop the unsaved items the user is
  // still looking at in the still-open modal.
  expect(resetForm).toHaveBeenCalledTimes(saveFails ? 0 : 1);
});
