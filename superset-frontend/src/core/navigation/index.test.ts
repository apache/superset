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

// Reset module state between tests so currentPageType is re-initialized.
beforeEach(() => {
  jest.resetModules();
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { pathname: '/' },
  });
});

async function importNavigation() {
  const mod = await import('./index');
  return mod;
}

test('getPageType returns "other" for unknown pathname', async () => {
  const { navigation } = await importNavigation();
  expect(navigation.getPageType()).toBe('other');
});

test('getPageType derives page type from window.location.pathname', async () => {
  window.location.pathname = '/superset/dashboard/42/';
  const { navigation } = await importNavigation();
  expect(navigation.getPageType()).toBe('dashboard');
});

test('notifyPageChange updates the current page type', async () => {
  const { navigation, notifyPageChange } = await importNavigation();
  notifyPageChange('/explore/?form_data={}');
  expect(navigation.getPageType()).toBe('explore');
});

test('notifyPageChange fires listeners on page type change', async () => {
  const { navigation, notifyPageChange } = await importNavigation();
  const listener = jest.fn();
  const disposable = navigation.onDidChangePage(listener);

  notifyPageChange('/superset/dashboard/1/');
  expect(listener).toHaveBeenCalledWith('dashboard');

  disposable.dispose();
});

test('notifyPageChange does not fire listeners when page type is unchanged', async () => {
  window.location.pathname = '/superset/dashboard/1/';
  const { navigation, notifyPageChange } = await importNavigation();
  const listener = jest.fn();
  navigation.onDidChangePage(listener);

  notifyPageChange('/superset/dashboard/2/');
  expect(listener).not.toHaveBeenCalled();
});

test('onDidChangePage listener is removed after dispose', async () => {
  const { navigation, notifyPageChange } = await importNavigation();
  const listener = jest.fn();
  const disposable = navigation.onDidChangePage(listener);

  disposable.dispose();
  notifyPageChange('/superset/dashboard/1/');
  expect(listener).not.toHaveBeenCalled();
});

test('sqllab path is matched with and without trailing slash', async () => {
  const { notifyPageChange, navigation } = await importNavigation();
  notifyPageChange('/sqllab');
  expect(navigation.getPageType()).toBe('sqllab');
  notifyPageChange('/explore/');
  notifyPageChange('/sqllab/');
  expect(navigation.getPageType()).toBe('sqllab');
});

test('chart and dashboard list pages get their own page types', async () => {
  const { notifyPageChange, navigation } = await importNavigation();
  notifyPageChange('/chart/list/');
  expect(navigation.getPageType()).toBe('chart_list');
  notifyPageChange('/dashboard/list/');
  expect(navigation.getPageType()).toBe('dashboard_list');
});

test('dataset list and single-dataset pages get distinct page types', async () => {
  const { notifyPageChange, navigation } = await importNavigation();
  notifyPageChange('/tablemodelview/list/');
  expect(navigation.getPageType()).toBe('dataset_list');
  notifyPageChange('/dataset/42');
  expect(navigation.getPageType()).toBe('dataset');
});

test('sqllab editor, query history, and saved queries get distinct page types', async () => {
  const { notifyPageChange, navigation } = await importNavigation();
  notifyPageChange('/sqllab/');
  expect(navigation.getPageType()).toBe('sqllab');
  notifyPageChange('/sqllab/history/');
  expect(navigation.getPageType()).toBe('query_history');
  notifyPageChange('/savedqueryview/list/');
  expect(navigation.getPageType()).toBe('saved_queries');
});

test('chart/add resolves to explore, not chart_list', async () => {
  const { notifyPageChange, navigation } = await importNavigation();
  notifyPageChange('/chart/add');
  expect(navigation.getPageType()).toBe('explore');
});
