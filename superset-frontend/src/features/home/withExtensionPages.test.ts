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

const mockApplicationRoot = jest.fn<string, []>(() => '');

// The app root is read through `ensureAppRoot`, which resolves it per call,
// so mocking the reader is enough -- no module reset, and no second React.
jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    ...actual,
    applicationRoot: () => mockApplicationRoot(),
  };
});

afterEach(() => mockApplicationRoot.mockReturnValue(''));

const menu = [
  { label: 'Dashboards', name: 'Dashboards', url: '/dashboard/list/' },
];

// What `useContributedPages` hands these two: a page id, the page's own name
// as the label, and the section the menu item asked for. Whether the user may
// open the page is settled before this point, so there is no `permitted` here
// -- those cases live against the hook that decides them.
const page = (over: Record<string, unknown> = {}) => ({
  name: 'Review queue',
  id: 'acme.tools.review-queue',
  ...over,
});

test('a page opting into the nav is appended at the address the host forms', () => {
  const result = withExtensionPages(menu as never, [page()]);

  expect(result).toHaveLength(2);
  expect(result[1]).toMatchObject({
    label: 'Review queue',
    url: '/extensions/pages/acme.tools.review-queue',
  });
});

test("the label is the page's own name", () => {
  const result = withExtensionPages(menu as never, [
    page({ section: undefined }),
  ]);

  expect(result[1]).toMatchObject({ label: 'Review queue' });
});

test('the order the menu settled is preserved, not re-sorted', () => {
  // `getMenu` has already applied the author's `order` and then registration
  // order for ties, so the sequence reaching this helper is the authoritative
  // one. Re-sorting here -- by id or anything else -- would discard the
  // `order` an author chose, which is why it does not.
  const arrived = [
    page({ id: 'acme.tools.data-lineage', name: 'Lineage' }),
    page({ id: 'acme.tools.approvals', name: 'Approvals' }),
    page({ id: 'acme.tools.review-log', name: 'Audit' }),
  ];

  const order = (pages: ReturnType<typeof page>[]) =>
    withExtensionPages(menu as never, pages)
      .slice(menu.length)
      .map(item => item.url);

  expect(order(arrived)).toEqual([
    '/extensions/pages/acme.tools.data-lineage',
    '/extensions/pages/acme.tools.approvals',
    '/extensions/pages/acme.tools.review-log',
  ]);

  // Reversing the input reverses the output: the helper is order-preserving,
  // so it cannot be hiding a sort of its own.
  expect(order([...arrived].reverse())).toEqual([...order(arrived)].reverse());
});

test('host entries keep their order and come first', () => {
  const hostMenu = [
    { label: 'Dashboards', name: 'Dashboards', url: '/dashboard/list/' },
    { label: 'Charts', name: 'Charts', url: '/chart/list/' },
  ];

  const result = withExtensionPages(hostMenu as never, [
    page({ id: 'acme.tools.approvals', name: 'Approvals' }),
  ]);

  expect(result.map(item => item.name)).toEqual([
    'Dashboards',
    'Charts',
    'extension:acme.tools.approvals',
  ]);
});

test('a page with no section belongs to the navbar', () => {
  // Which of the two surfaces an entry lands on is the menu item's own
  // choice: no section means the bar, a section means that group of
  // Settings. A page that should be reachable by URL and advertised nowhere
  // registers no menu item at all, so it never reaches either function.
  const result = withExtensionPages(menu as never, [page()]);

  expect(result).toHaveLength(2);
  expect(result[1]).toMatchObject({ label: 'Review queue' });
});

test('this function does not filter, it places', () => {
  // Whether the user may open a page, and whether anything registered it,
  // are both settled by `useContributedPages` before an entry gets here.
  // Re-testing them here would pass whatever this function did, because it
  // would be asserting against a list that was already filtered -- so what
  // is worth pinning is that nothing handed in is silently dropped.
  const result = withExtensionPages(menu as never, [
    page({ id: 'acme.tools.one', name: 'One' }),
    page({ id: 'acme.tools.two', name: 'Two' }),
  ]);

  expect(result.slice(menu.length).map(e => e.label)).toEqual(['One', 'Two']);
});

test('every entry handed in is rendered', () => {
  // The flag is absent for a page with no declared permission, and from an
  // older server. Treating absent as refused would hide every page.
  const result = withExtensionPages(menu as never, [page()]);

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
    [page({ name: 'Charts', id: 'acme.tools.review-charts' })],
  );

  expect(result[1]).toMatchObject({
    label: 'Charts',
    url: '/extensions/pages/acme.tools.review-charts',
  });
  expect(result.map(item => (item as { name: string }).name)).toEqual([
    'Charts',
    'extension:acme.tools.review-charts',
  ]);
});

const settings = [
  {
    name: 'Manage',
    label: 'Manage',
    childs: [
      { label: 'CSS Templates', name: 'CssTemplate', url: '/csstemplate/' },
    ],
  },
  { name: 'Security', label: 'Security', childs: [] },
];

test('a page naming a category joins that group instead of the navbar', () => {
  // `MenuWrapper` splits the FAB menu by group name, so an entry appended
  // to the navbar list can never reach Settings.
  const result = withExtensionSettings(settings as never, [
    page({ name: 'Change review', section: 'Manage' }),
  ]);

  const manage = result.find(group => group.name === 'Manage');
  expect(manage?.childs).toHaveLength(2);
  expect(manage?.childs?.[1]).toMatchObject({
    label: 'Change review',
    url: '/extensions/pages/acme.tools.review-queue',
  });
});

test('the host entries in that group are kept, and come first', () => {
  const result = withExtensionSettings(settings as never, [
    page({ name: 'Change review', section: 'Manage' }),
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
    page({ name: 'Change review', section: 'Manage' }),
  ]);

  expect(result).toHaveLength(1);
  expect(result[0].name).toBe('Security');
});

test('nothing handed in is silently dropped from a group', () => {
  const result = withExtensionSettings(settings as never, [
    page({ id: 'acme.tools.a', name: 'A', section: 'Manage' }),
    page({ id: 'acme.tools.b', name: 'B', section: 'Manage' }),
  ]);

  expect(result.find(g => g.name === 'Manage')?.childs).toHaveLength(3);
});

test('an item naming no section is appended after the built-ins', () => {
  // The SIP's rule for the Settings dropdown. It arrives in a trailing
  // group because `RightMenu` renders every element of `settings` as one
  // from its `childs`, so a bare entry here would render as a heading
  // with nothing under it. The group carries no label, so what a reader
  // sees is the item after the last built-in section.
  const result = withExtensionSettings(settings as never, [page()]);

  expect(result).toHaveLength(settings.length + 1);
  const trailing = result[result.length - 1];
  expect(trailing.label).toBe('');
  expect(trailing.name).toBe('extension:settings');
  expect((trailing.childs ?? []).map(c => (c as { label: string }).label)) //
    .toEqual(['Review queue']);
});

test('no trailing group is added when every item names a section', () => {
  const result = withExtensionSettings(settings as never, [
    page({ section: 'Manage' }),
  ]);

  expect(result).toHaveLength(settings.length);
  expect(result.some(g => g.name === 'extension:settings')).toBe(false);
});

test('a section naming a group that is not there drops the item', () => {
  // Where the two rules meet, and the one sharp edge left. The named group
  // is not invented, and naming a section opts out of the trailing group,
  // so a misspelled section loses the entry with nothing said. Pinned as
  // the current behaviour rather than endorsed: the alternative is to fall
  // back to the trailing group, which needs a decision on the SIP thread
  // because it would also silently relocate a Manage screen on an
  // instance where FAB did not build Manage.
  const result = withExtensionSettings([settings[1]] as never, [
    page({ section: 'Mannage' }),
  ]);

  expect(result).toHaveLength(1);
  expect(result[0].name).toBe('Security');
});

test('a navbar item naming a section still renders, section ignored', () => {
  // The published type says `section` is "ignored where a location has no
  // groups", and the navbar has none -- so it is ignored, not treated as a
  // reason to drop the entry. The two helpers are fed different lists
  // (`global.navbar` items and `global.settingsMenu` items), so an item
  // skipped here would not reappear under Settings; it would just vanish.
  const navPages = withExtensionPages([] as never, [
    page({ name: 'Change review', section: 'Manage' }),
  ]);

  expect(navPages).toHaveLength(1);
  expect(navPages[0]).toMatchObject({ label: 'Change review' });
});

test('a page entry renders as a url and has no handler', () => {
  // A page has to render as a real link: middle-click, ctrl-click, open in
  // a new tab, and the active-tab highlight all depend on an `href`.
  const [entry] = withExtensionPages([] as never, [page()]);

  expect(entry.onClick).toBeUndefined();
  expect(entry.url).toBe('/extensions/pages/acme.tools.review-queue');
});

test('a named icon is rendered beside the label', () => {
  const [entry] = withExtensionPages([] as never, [
    page({ icon: 'DatabaseOutlined' }),
  ]);

  expect(entry.icon).toBeTruthy();
});

test('an unknown icon name costs the icon, not the entry', () => {
  // The name crosses the extension boundary as a string, so it is an
  // author's spelling against the host's catalogue. A typo should not
  // remove the menu entry.
  const [entry] = withExtensionPages([] as never, [
    page({ icon: 'NoSuchIconExists' }),
  ]);

  expect(entry.icon).toBeUndefined();
  expect(entry.label).toBe('Review queue');
});

test.each(['constructor', 'valueOf', 'hasOwnProperty', 'toString'])(
  'an icon named %p reaches Object.prototype and must not render',
  name => {
    // `Icons` is a plain object literal, so a bare index finds these on
    // the prototype. They are truthy, and rendering one throws inside
    // `Menu` -- which has no error boundary above it, so the whole app
    // shell would blank because an extension misspelled an icon.
    const [entry] = withExtensionPages([] as never, [page({ icon: name })]);

    expect(entry.icon).toBeUndefined();
    expect(entry.label).toBe('Review queue');
  },
);

test('no icon named, nothing rendered', () => {
  const [entry] = withExtensionPages([] as never, [page()]);

  expect(entry.icon).toBeUndefined();
});

// Under a subdirectory deployment, every other `url` in this menu is
// already rooted -- the backend emits host entries through `url_for` -- and
// `buildMenuItem` strips the root again before handing the path to
// `NavLink`. A contributed entry has to follow the same convention or it
// survives that round trip only by accident.
test('a contributed entry carries the application root', () => {
  mockApplicationRoot.mockReturnValue('/analytics');

  const [entry] = withExtensionPages([] as never, [
    page({ id: 'acme.tools.review-queue', name: 'Queue' }),
  ]);

  expect(entry.url).toBe('/analytics/extensions/pages/acme.tools.review-queue');
});

test('a Settings child carries the application root too', () => {
  mockApplicationRoot.mockReturnValue('/analytics');

  const result = withExtensionSettings(
    [{ name: 'Manage', label: 'Manage', childs: [] }] as never,
    [
      page({
        id: 'acme.tools.approvals',
        name: 'Approvals',
        section: 'Manage',
      }),
    ],
  );

  expect(result.find(g => g.name === 'Manage')?.childs?.[0]).toMatchObject({
    url: '/analytics/extensions/pages/acme.tools.approvals',
  });
});

test('the root is applied exactly once, never twice', () => {
  mockApplicationRoot.mockReturnValue('/analytics');

  const [entry] = withExtensionPages([] as never, [
    page({ id: 'acme.tools.review-queue', name: 'Queue' }),
  ]);

  // Matched against what a doubled root would actually produce. The
  // address carries the page prefix too, so comparing with a bare
  // `/analytics/analytics/review-queue` holds whether or not the root was
  // applied twice.
  expect(entry.url).not.toMatch(/^\/analytics\/analytics\//);
  expect(entry.url).toBe('/analytics/extensions/pages/acme.tools.review-queue');
});

test('nothing is prefixed when the app serves from the domain root', () => {
  const [entry] = withExtensionPages([] as never, [
    page({ id: 'acme.tools.review-queue', name: 'Queue' }),
  ]);

  expect(entry.url).toBe('/extensions/pages/acme.tools.review-queue');
});

const many = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    page({
      id: `acme.tools.page-${i}`,
      name: `Page ${i}`,
    }),
  );

const names = (pages: ReturnType<typeof page>[]) =>
  withExtensionPages(menu as never, pages)
    .slice(menu.length)
    .map(item => item.name);

test('three or fewer stay on the bar', () => {
  expect(names(many(3))).toEqual([
    'extension:acme.tools.page-0',
    'extension:acme.tools.page-1',
    'extension:acme.tools.page-2',
  ]);
});

test('a fourth folds the tail into one dropdown', () => {
  // The dropdown costs a slot of its own, so two entries stay inline.
  expect(names(many(4))).toEqual([
    'extension:acme.tools.page-0',
    'extension:acme.tools.page-1',
    'extension:more',
  ]);
});

test('the bar never grows past the cap, however many are installed', () => {
  expect(names(many(30))).toHaveLength(3);
});

test('every page is still reachable, none dropped', () => {
  const [, , more] = withExtensionPages(menu as never, many(10)).slice(
    menu.length,
  );

  // Two stay inline, so the other eight are in the dropdown: ten in, ten
  // out, nothing silently dropped.
  expect(more.childs).toHaveLength(8);
  expect(more.childs?.map(c => (c as { name: string }).name)).toEqual(
    Array.from({ length: 8 }, (_, i) => `extension:acme.tools.page-${i + 2}`),
  );
});

test('the dropdown carries no url, which is what makes it a dropdown', () => {
  const [, , more] = withExtensionPages(menu as never, many(5)).slice(
    menu.length,
  );

  expect(more.url).toBeUndefined();
  expect(more.label).toBe('More');
});

test('a folded entry keeps the key the active-tab lookup uses', () => {
  // `buildMenuItem` keys a child by `name`, and the highlighting effect
  // sets `extension:<path>` -- so a page inside the dropdown still
  // highlights when it is open.
  const [, , more] = withExtensionPages(menu as never, many(5)).slice(
    menu.length,
  );

  expect(more.childs?.[0]).toMatchObject({
    name: 'extension:acme.tools.page-2',
    url: '/extensions/pages/acme.tools.page-2',
  });
});

test('every folded page is reachable from the dropdown', () => {
  const pages = [...many(4), page({ id: 'acme.tools.secret', name: 'Secret' })];

  const [, , more] = withExtensionPages(menu as never, pages).slice(
    menu.length,
  );

  expect(
    more.childs?.some(
      c => (c as { url: string }).url === '/extensions/pages/acme.tools.secret',
    ),
  ).toBe(true);
});
