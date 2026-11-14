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
async function registerPage(id: string) {
  const pages = await import('../pages');
  const Component = () => null;
  return pages.registerPageFor(
    'acme.tools',
    [{ id }],
    { id, name: 'Contributed' },
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
  const registered = await registerPage('acme.tools.approvals');
  try {
    notifyLocationChanged('/extensions/pages/acme.tools.approvals');
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
  const registered = await registerPage('acme.tools.approvals');
  const seen: string[] = [];
  const sub = navigation.onDidChangePage(page => seen.push(page));
  try {
    expect(navigation.getPage()).toBe('home');
    notifyLocationChanged('/extensions/pages/acme.tools.approvals');
    expect(seen).toEqual(['extension']);
  } finally {
    sub.dispose();
    registered.dispose();
  }
});

test('a contributed page is known from its address, before any bundle loads', async () => {
  // A cold load onto a contributed page. The address alone says what this
  // is, so there is nothing to settle later: when pages chose their own
  // paths the answer could not be known until the bundle claiming one had
  // arrived, and until then the page reported "home".
  window.location.pathname = '/extensions/pages/acme.tools.approvals';
  const { navigation } = await importNavigation();

  expect(navigation.getPage()).toBe('extension');
});

test('disposing a page does not change what its address is', async () => {
  // The address belongs to the host, not to whoever registered against it.
  // A disposed page leaves "page not found" at a URL that is still an
  // extension page, rather than the address reverting to the welcome screen.
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('acme.tools.approvals');
  notifyLocationChanged('/extensions/pages/acme.tools.approvals');
  expect(navigation.getPage()).toBe('extension');

  registered.dispose();
  expect(navigation.getPage()).toBe('extension');
});

test('a contributed page owns its sub-paths', async () => {
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('acme.tools.approvals');
  try {
    notifyLocationChanged('/extensions/pages/acme.tools.approvals/42/edit');
    expect(navigation.getPage()).toBe('extension');
  } finally {
    registered.dispose();
  }
});

test('a path that merely starts with the page prefix is not a page', async () => {
  // `/extensions/pagesomething` shares a prefix with `/extensions/pages/`
  // without sharing a segment boundary, and is not a contributed page.
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('acme.tools.approvals');
  try {
    notifyLocationChanged('/extensions/pagesomething');
    expect(navigation.getPage()).toBe('home');
  } finally {
    registered.dispose();
  }
});

test('a host screen is named for itself, whatever pages exist', async () => {
  // A page id can no longer produce a host address -- the host forms every
  // page's URL under its own prefix -- so this is not the collision it was
  // written for. It still pins the thing worth pinning: a registered page
  // does not change what an ordinary host screen reports.
  const { navigation, notifyLocationChanged } = await importNavigation();
  const registered = await registerPage('acme.tools.dashboard-list');
  try {
    notifyLocationChanged('/dashboard/list/');
    expect(navigation.getPage()).toBe('dashboard_list');
  } finally {
    registered.dispose();
  }
});

test('moving between two contributed pages does not change the surface', async () => {
  // Deliberate, and the reason `pages.onDidChangeCurrentPage` exists. `Page`
  // names the surface, and both of these are `'extension'`, so this module
  // has nothing to report. An extension that needs to know *which* page it
  // is on asks the registry.
  const { navigation, notifyLocationChanged } = await importNavigation();
  const first = await registerPage('acme.tools.approvals');
  const second = await registerPage('acme.tools.review-log');
  try {
    notifyLocationChanged('/extensions/pages/acme.tools.approvals');
    expect(navigation.getPage()).toBe('extension');

    const seen: string[] = [];
    const sub = navigation.onDidChangePage(page => seen.push(page));
    notifyLocationChanged('/extensions/pages/acme.tools.review-log');

    expect(navigation.getPage()).toBe('extension');
    expect(seen).toEqual([]);
    sub.dispose();
  } finally {
    first.dispose();
    second.dispose();
  }
});
