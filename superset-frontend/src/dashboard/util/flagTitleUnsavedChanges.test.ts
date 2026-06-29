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
import { useDashboardStateStore } from 'src/dashboard/stores';
import {
  flagTitleUnsavedChanges,
  resetTitleDirtyFlag,
  type TitleDirtyRef,
} from './flagTitleUnsavedChanges';

const isDirty = () => useDashboardStateStore.getState().hasUnsavedChanges;

beforeEach(() => {
  useDashboardStateStore.setState({ hasUnsavedChanges: false });
});

test('flags unsaved when a title diverges from the saved value', () => {
  const ref: TitleDirtyRef = { current: undefined };
  flagTitleUnsavedChanges('Sales', 'SalesX', ref);
  expect(isDirty()).toBe(true);
});

test('clears unsaved when the title is reverted and this edit was the sole change', () => {
  const ref: TitleDirtyRef = { current: undefined };
  flagTitleUnsavedChanges('Sales', 'SalesX', ref); // diverged -> dirty
  flagTitleUnsavedChanges('Sales', 'Sales', ref); // reverted -> clean
  expect(isDirty()).toBe(false);
});

test('keeps unsaved on revert when the dashboard was already dirty (e.g. a layout edit)', () => {
  useDashboardStateStore.setState({ hasUnsavedChanges: true });
  const ref: TitleDirtyRef = { current: undefined };
  flagTitleUnsavedChanges('Sales', 'SalesX', ref); // diverged
  flagTitleUnsavedChanges('Sales', 'Sales', ref); // reverted, but other edit pending
  expect(isDirty()).toBe(true);
});

test('reset on editing-end prevents a later revert from clearing a concurrent edit', () => {
  const ref: TitleDirtyRef = { current: undefined };
  flagTitleUnsavedChanges('Sales', 'SalesX', ref); // edit title on a clean board
  resetTitleDirtyFlag(ref); // editing ends (blur)
  useDashboardStateStore.setState({ hasUnsavedChanges: true }); // a different edit dirties it
  flagTitleUnsavedChanges('Sales', 'SalesY', ref); // re-edit the title...
  flagTitleUnsavedChanges('Sales', 'Sales', ref); // ...and revert it
  // The concurrent edit's dirty state is preserved (no data loss).
  expect(isDirty()).toBe(true);
});
