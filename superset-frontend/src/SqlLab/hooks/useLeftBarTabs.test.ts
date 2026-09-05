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
import {
  registerTestView,
  registerTestViewContainer,
  cleanupExtensions,
} from 'spec/helpers/extensionTestHelpers';
import { ViewLocations } from 'src/SqlLab/contributions';
import { resetLeftBarViews } from 'src/SqlLab/components/SqlEditorLeftBar/builtins';
import {
  applyLeftBarViewSettings,
  resetLeftBarViewSettings,
} from './useLeftBarViewSettings';
import {
  TAB_EXPLORER_ID,
  TAB_SETTINGS_ID,
} from './useManageableLeftBarEntries';
import { useLeftBarTabs } from './useLeftBarTabs';

const noop = () => null;

const registerLeftBarView = (id: string, name: string) => {
  registerTestViewContainer(ViewLocations.sqllab.leftSidebar, id, name, noop);
  registerTestView(id, id, name, noop);
};

beforeEach(() => {
  resetLeftBarViews();
  resetLeftBarViewSettings();
});

afterEach(cleanupExtensions);

test('returns an empty list when nothing beyond the built-ins is registered', () => {
  const { result } = renderHook(() => useLeftBarTabs());
  expect(result.current).toEqual([]);
});

test('prepends Explorer and appends Settings once a view is registered', () => {
  registerLeftBarView('ext.a', 'Ext A');

  const { result } = renderHook(() => useLeftBarTabs());

  expect(result.current.map(tab => tab.id)).toEqual([
    TAB_EXPLORER_ID,
    'ext.a',
    TAB_SETTINGS_ID,
  ]);
});

test('respects a custom order applied through settings, appending unordered ids (Explorer included) at the end', () => {
  // Explorer participates in ordering exactly like any other manageable
  // entry now: since it's not named in `order`, it falls into the
  // "unordered" bucket and sorts after the explicitly-ordered ids, in its
  // original relative position among the other unordered ones.
  registerLeftBarView('ext.a', 'A');
  registerLeftBarView('ext.b', 'B');
  registerLeftBarView('ext.c', 'C');
  applyLeftBarViewSettings({ order: ['ext.c', 'ext.a'], hidden: [] });

  const { result } = renderHook(() => useLeftBarTabs());

  expect(result.current.map(tab => tab.id)).toEqual([
    'ext.c',
    'ext.a',
    TAB_EXPLORER_ID,
    'ext.b',
    TAB_SETTINGS_ID,
  ]);
});

test('Explorer can be explicitly repositioned via a custom order, like any other manageable entry', () => {
  registerLeftBarView('ext.a', 'A');
  registerLeftBarView('ext.b', 'B');
  applyLeftBarViewSettings({
    order: ['ext.b', TAB_EXPLORER_ID, 'ext.a'],
    hidden: [],
  });

  const { result } = renderHook(() => useLeftBarTabs());

  expect(result.current.map(tab => tab.id)).toEqual([
    'ext.b',
    TAB_EXPLORER_ID,
    'ext.a',
    TAB_SETTINGS_ID,
  ]);
});

test('filters out hidden views but keeps Settings reachable', () => {
  registerLeftBarView('ext.a', 'A');
  registerLeftBarView('ext.b', 'B');
  applyLeftBarViewSettings({ order: [], hidden: ['ext.a'] });

  const { result } = renderHook(() => useLeftBarTabs());

  expect(result.current.map(tab => tab.id)).toEqual([
    TAB_EXPLORER_ID,
    'ext.b',
    TAB_SETTINGS_ID,
  ]);
});

test('Explorer itself can be hidden via settings, like any other manageable entry', () => {
  registerLeftBarView('ext.a', 'A');
  applyLeftBarViewSettings({ order: [], hidden: [TAB_EXPLORER_ID] });

  const { result } = renderHook(() => useLeftBarTabs());

  expect(result.current.map(tab => tab.id)).toEqual(['ext.a', TAB_SETTINGS_ID]);
});

test('Settings stays reachable even when every registered view is hidden', () => {
  registerLeftBarView('ext.a', 'A');
  applyLeftBarViewSettings({ order: [], hidden: ['ext.a'] });

  const { result } = renderHook(() => useLeftBarTabs());

  expect(result.current.map(tab => tab.id)).toEqual([
    TAB_EXPLORER_ID,
    TAB_SETTINGS_ID,
  ]);
});

test('Settings stays reachable even when Explorer and every registered view are hidden', () => {
  registerLeftBarView('ext.a', 'A');
  applyLeftBarViewSettings({
    order: [],
    hidden: [TAB_EXPLORER_ID, 'ext.a'],
  });

  const { result } = renderHook(() => useLeftBarTabs());

  expect(result.current.map(tab => tab.id)).toEqual([TAB_SETTINGS_ID]);
});
