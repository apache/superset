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

// Reset module state between tests so currentPage is re-initialized.
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

test('getPage falls back to "home" for the welcome page and unknown pathnames', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  // The default pathname ('/') is not enumerated and falls back to home.
  expect(navigation.getPage()).toBe('home');
  notifyLocationChanged('/welcome/');
  expect(navigation.getPage()).toBe('home');
});

test('getPage derives the page from window.location.pathname', async () => {
  window.location.pathname = '/dashboard/42/';
  const { navigation } = await importNavigation();
  expect(navigation.getPage()).toBe('dashboard');
});

test('notifyLocationChanged updates the current page type', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  notifyLocationChanged('/explore/?form_data={}');
  expect(navigation.getPage()).toBe('explore');
});

test('notifyLocationChanged fires listeners on page type change', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  const listener = jest.fn();
  const disposable = navigation.onDidChangePage(listener);

  notifyLocationChanged('/dashboard/1/');
  expect(listener).toHaveBeenCalledWith('dashboard');

  disposable.dispose();
});

test('notifyLocationChanged does not fire listeners when page type is unchanged', async () => {
  window.location.pathname = '/dashboard/1/';
  const { navigation, notifyLocationChanged } = await importNavigation();
  const listener = jest.fn();
  navigation.onDidChangePage(listener);

  notifyLocationChanged('/dashboard/2/');
  expect(listener).not.toHaveBeenCalled();
});

test('onDidChangePage listener is removed after dispose', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  const listener = jest.fn();
  const disposable = navigation.onDidChangePage(listener);

  disposable.dispose();
  notifyLocationChanged('/dashboard/1/');
  expect(listener).not.toHaveBeenCalled();
});

test('sqllab path is matched with and without trailing slash', async () => {
  const { notifyLocationChanged, navigation } = await importNavigation();
  notifyLocationChanged('/sqllab');
  expect(navigation.getPage()).toBe('sqllab');
  notifyLocationChanged('/explore/');
  notifyLocationChanged('/sqllab/');
  expect(navigation.getPage()).toBe('sqllab');
});

test('chart and dashboard list pages get their own page types', async () => {
  const { notifyLocationChanged, navigation } = await importNavigation();
  notifyLocationChanged('/chart/list/');
  expect(navigation.getPage()).toBe('chart_list');
  notifyLocationChanged('/dashboard/list/');
  expect(navigation.getPage()).toBe('dashboard_list');
});

test('dataset list and single-dataset pages get distinct page types', async () => {
  const { notifyLocationChanged, navigation } = await importNavigation();
  notifyLocationChanged('/tablemodelview/list/');
  expect(navigation.getPage()).toBe('dataset_list');
  notifyLocationChanged('/dataset/42');
  expect(navigation.getPage()).toBe('dataset');
});

test('sqllab editor, query history, and saved queries get distinct page types', async () => {
  const { notifyLocationChanged, navigation } = await importNavigation();
  notifyLocationChanged('/sqllab/');
  expect(navigation.getPage()).toBe('sqllab');
  notifyLocationChanged('/sqllab/history/');
  expect(navigation.getPage()).toBe('query_history');
  notifyLocationChanged('/savedqueryview/list/');
  expect(navigation.getPage()).toBe('saved_queries');
});

test('chart/add resolves to explore, not chart_list', async () => {
  const { notifyLocationChanged, navigation } = await importNavigation();
  notifyLocationChanged('/chart/add');
  expect(navigation.getPage()).toBe('explore');
});
