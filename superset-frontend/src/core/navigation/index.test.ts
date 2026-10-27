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

/**
 * Register a contributed page the way the loader does.
 *
 * Imported after `importNavigation` so both modules come from the same
 * registry instance -- `jest.resetModules()` means a second import would
 * otherwise give navigation a different `pages` module than this does, and
 * nothing would be found.
 */
async function registerPage(path: string) {
  const pages = await import('../pages');
  const Component = () => null;
  return pages.registerPageFor(
    'acme.tools',
    [{ path }],
    { path, name: 'Contributed' },
    Component as never,
  );
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

test('a contributed page derives "extension", not "home"', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('/approvals');
  try {
    notifyLocationChanged('/approvals');
    expect(navigation.getPage()).toBe('extension');
  } finally {
    registered.dispose();
  }
});

test('moving from home to a contributed page fires, rather than nothing', async () => {
  // The defect this closes: both ends derived 'home', so the early return in
  // `notifyLocationChanged` meant an extension listening for the move was
  // never told the user had left the welcome screen.
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('/approvals');
  const seen: string[] = [];
  const sub = navigation.onDidChangePage(page => seen.push(page));
  try {
    expect(navigation.getPage()).toBe('home');
    notifyLocationChanged('/approvals');
    expect(seen).toEqual(['extension']);
  } finally {
    sub.dispose();
    registered.dispose();
  }
});

test('a page registering while its address is open fires the change', async () => {
  // A cold load onto a contributed page: the address is already in the bar
  // before the bundle that claims it has arrived, so the registration is what
  // settles what the page is.
  window.location.pathname = '/approvals';
  const { navigation } = await importNavigation();
  const seen: string[] = [];
  const sub = navigation.onDidChangePage(page => seen.push(page));
  const registered = await registerPage('/approvals');
  try {
    expect(seen).toEqual(['extension']);
    expect(navigation.getPage()).toBe('extension');
  } finally {
    sub.dispose();
    registered.dispose();
  }
});

test('disposing a contributed page gives its address back to "home"', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('/approvals');
  notifyLocationChanged('/approvals');
  expect(navigation.getPage()).toBe('extension');

  registered.dispose();
  expect(navigation.getPage()).toBe('home');
});

test('a contributed page owns its sub-paths', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('/approvals');
  try {
    notifyLocationChanged('/approvals/42/edit');
    expect(navigation.getPage()).toBe('extension');
  } finally {
    registered.dispose();
  }
});

test('a path that merely starts with a page path is not that page', async () => {
  // `/approvalsomething` shares a prefix with `/approvals` without sharing a
  // segment boundary, and belongs to neither.
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('/approvals');
  try {
    notifyLocationChanged('/approvalsomething');
    expect(navigation.getPage()).toBe('home');
  } finally {
    registered.dispose();
  }
});

test('a host route still wins over a contributed page at the same path', async () => {
  // The server refuses a page whose path a host route already serves, so this
  // cannot arise in a running deployment -- but the order inside `derivePage`
  // is what guarantees it, and that is worth pinning.
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('/dashboard/list');
  try {
    notifyLocationChanged('/dashboard/list/');
    expect(navigation.getPage()).toBe('dashboard_list');
  } finally {
    registered.dispose();
  }
});
