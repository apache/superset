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

import { withExtensionPages, withExtensionSettings } from './Menu';

const menu = [{ label: 'Dashboards', name: 'Dashboards', url: '/dashboard/list/' }];

const page = (over: Record<string, unknown> = {}) => ({
  name: 'Review queue',
  path: '/review-queue',
  nav: { label: 'Queue' },
  permitted: true,
  ...over,
});

test('a page opting into the nav is appended with its own path', () => {
  const result = withExtensionPages(menu as never, [page()]);

  expect(result).toHaveLength(2);
  expect(result[1]).toMatchObject({ label: 'Queue', url: '/review-queue' });
});

test('the page name is used when nav carries no label', () => {
  const result = withExtensionPages(menu as never, [page({ nav: {} })]);

  expect(result[1]).toMatchObject({ label: 'Review queue' });
});

test('a page that did not opt in is left out', () => {
  // Reachable by URL, but nothing advertises it -- for a page an extension
  // links to from one of its own screens.
  expect(withExtensionPages(menu as never, [page({ nav: undefined })])).toEqual(
    menu,
  );
});

test('a page the user may not open is left out', () => {
  // The server answers 403 for it, so an entry here would advertise a dead
  // end. The page stays registered so a direct link still explains itself.
  expect(
    withExtensionPages(menu as never, [page({ permitted: false })]),
  ).toEqual(menu);
});

test('a page whose permission the server did not report is shown', () => {
  // The flag is absent for a page with no declared permission, and from an
  // older server. Treating absent as refused would hide every page.
  const result = withExtensionPages(menu as never, [
    page({ permitted: undefined }),
  ]);

  expect(result).toHaveLength(2);
});

test('the host menu is returned untouched when nothing is contributed', () => {
  expect(withExtensionPages(menu as never, [])).toBe(menu);
});

test('a page labelled like a host entry does not collide with its key', () => {
  // `name` is the React key. The label is the extension author's to choose,
  // so a page labelled "Charts" would duplicate the host's own entry key.
  const result = withExtensionPages(
    [{ label: 'Charts', name: 'Charts', url: '/chart/list/' }] as never,
    [page({ nav: { label: 'Charts' }, path: '/review-charts' })],
  );

  expect(result[1]).toMatchObject({ label: 'Charts', url: '/review-charts' });
  expect(result.map(item => (item as { name: string }).name)).toEqual([
    'Charts',
    'extension:/review-charts',
  ]);
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('withExtensionSettings', () => {
  const settings = [
    {
      name: 'Manage',
      label: 'Manage',
      childs: [{ label: 'CSS Templates', name: 'CssTemplate', url: '/csstemplate/' }],
    },
    { name: 'Security', label: 'Security', childs: [] },
  ];

  test('a page naming a category joins that group instead of the navbar', () => {
    // `MenuWrapper` splits the FAB menu by group name, so an entry appended
    // to the navbar list can never reach Settings.
    const result = withExtensionSettings(settings as never, [
      page({ nav: { label: 'Change review', category: 'Manage' } }),
    ]);

    const manage = result.find(group => group.name === 'Manage');
    expect(manage?.childs).toHaveLength(2);
    expect(manage?.childs?.[1]).toMatchObject({
      label: 'Change review',
      url: '/review-queue',
    });
  });

  test('the host entries in that group are kept, and come first', () => {
    const result = withExtensionSettings(settings as never, [
      page({ nav: { label: 'Change review', category: 'Manage' } }),
    ]);

    expect(
      (result.find(g => g.name === 'Manage')?.childs ?? []).map(
        c => (c as { label: string }).label,
      ),
    ).toEqual(['CSS Templates', 'Change review']);
  });

  test('a group the host did not render is not invented', () => {
    // FAB builds Manage only when the reader may see something in it. A
    // group conjured here would be one the rest of Superset does not agree
    // exists; the page keeps its URL, it is the entry that is missing.
    const result = withExtensionSettings([settings[1]] as never, [
      page({ nav: { label: 'Change review', category: 'Manage' } }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Security');
  });

  test('a page the user may not open is left out', () => {
    const result = withExtensionSettings(settings as never, [
      page({ nav: { label: 'Change review', category: 'Manage' }, permitted: false }),
    ]);

    expect(result.find(g => g.name === 'Manage')?.childs).toHaveLength(1);
  });

  test('a page with no category is left for the navbar', () => {
    expect(withExtensionSettings(settings as never, [page()])).toBe(settings);
  });

  test('the navbar and Settings never both take the same page', () => {
    // The two helpers partition on `nav.category`, so a page cannot appear
    // twice under different labels.
    const navPages = withExtensionPages([] as never, [
      page({ nav: { label: 'Change review', category: 'Manage' } }),
    ]);

    expect(navPages).toHaveLength(0);
  });
});
