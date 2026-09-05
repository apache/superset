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
import {
  registerTestView,
  registerTestViewContainer,
  cleanupExtensions,
} from 'spec/helpers/extensionTestHelpers';
import { ViewLocations } from 'src/SqlLab/contributions';
import { resetLeftBarViews } from 'src/SqlLab/components/SqlEditorLeftBar/builtins';
import { SQL_EDITOR_LEFTBAR_WIDTH } from 'src/SqlLab/constants';
import { TAB_EXPLORER_ID } from './useManageableLeftBarEntries';
import { resetLeftBarViewSettings } from './useLeftBarViewSettings';
import {
  getLeftPanelLayout,
  resetLeftBarLayoutState,
  useLeftBarLayout,
} from './useLeftBarLayout';

const registerLeftBarView = (id: string, name: string) => {
  registerTestViewContainer(
    ViewLocations.sqllab.leftSidebar,
    id,
    name,
    () => null,
  );
  registerTestView(id, id, name, () => null);
};

beforeEach(() => {
  resetLeftBarViews();
  resetLeftBarLayoutState();
  resetLeftBarViewSettings();
});

afterEach(cleanupExtensions);

test('getLeftPanelLayout returns a zero-width but still-collapsible panel when the rail collapses the content', () => {
  // The rail lives outside the Splitter now (see AppLayout), so collapsing
  // via the rail fully collapses the content panel — there's no separate
  // "icon strip width" to reserve inside it any more. `min` stays at the
  // expanded width (not 0) so the Splitter's own collapse chevron, which
  // AppLayout renders in every state, isn't a dead click from here.
  expect(
    getLeftPanelLayout({
      leftWidth: 400,
      contentCollapsed: true,
      hasRail: true,
    }),
  ).toEqual({
    size: 0,
    min: SQL_EDITOR_LEFTBAR_WIDTH,
    resizable: false,
  });
});

test('getLeftPanelLayout restores min to the expanded width once the sidebar is fully hidden, even with a stale collapsed flag', () => {
  // This is the regression guard for the hidden -> expanded restore: if this
  // ever clamps to the rail width instead, re-opening a fully hidden sidebar
  // would stick at the rail width.
  expect(
    getLeftPanelLayout({ leftWidth: 0, contentCollapsed: true, hasRail: true }),
  ).toEqual({
    size: 0,
    min: SQL_EDITOR_LEFTBAR_WIDTH,
    resizable: true,
  });
});

test('getLeftPanelLayout ignores contentCollapsed when there is no rail', () => {
  expect(
    getLeftPanelLayout({
      leftWidth: 400,
      contentCollapsed: true,
      hasRail: false,
    }),
  ).toEqual({
    size: 400,
    min: SQL_EDITOR_LEFTBAR_WIDTH,
    resizable: true,
  });
});

test('getLeftPanelLayout returns the expanded shape when content is not collapsed', () => {
  expect(
    getLeftPanelLayout({
      leftWidth: 500,
      contentCollapsed: false,
      hasRail: true,
    }),
  ).toEqual({
    size: 500,
    min: SQL_EDITOR_LEFTBAR_WIDTH,
    resizable: true,
  });
});

test('hasRail is false with no registered views, and toggling content has no effect', () => {
  const { result } = renderHook(() => useLeftBarLayout());

  expect(result.current.hasRail).toBe(false);

  act(() => result.current.toggleContent());
  expect(result.current.contentCollapsed).toBe(false);
});

test('selectView activates a view and clears collapse; re-toggling collapses and re-expands it', () => {
  registerLeftBarView('ext.a', 'A');
  const { result } = renderHook(() => useLeftBarLayout());

  expect(result.current.hasRail).toBe(true);
  expect(result.current.activeViewId).toBe(TAB_EXPLORER_ID);

  act(() => result.current.selectView('ext.a'));
  expect(result.current.activeViewId).toBe('ext.a');
  expect(result.current.contentCollapsed).toBe(false);

  act(() => result.current.toggleContent());
  expect(result.current.contentCollapsed).toBe(true);

  act(() => result.current.toggleContent());
  expect(result.current.contentCollapsed).toBe(false);
});

test('selection and collapse state are shared across separate hook instances', () => {
  registerLeftBarView('ext.a', 'A');
  const { result: first } = renderHook(() => useLeftBarLayout());
  act(() => first.current.selectView('ext.a'));

  const { result: second } = renderHook(() => useLeftBarLayout());
  expect(second.current.activeViewId).toBe('ext.a');
});

test('expandContent clears a collapsed state', () => {
  registerLeftBarView('ext.a', 'A');
  const { result } = renderHook(() => useLeftBarLayout());

  act(() => result.current.toggleContent());
  expect(result.current.contentCollapsed).toBe(true);

  act(() => result.current.expandContent());
  expect(result.current.contentCollapsed).toBe(false);
});
