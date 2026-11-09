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

const page = (over: Record<string, unknown> = {}) => ({
  name: 'Review queue',
  path: '/review-queue',
  nav: { label: 'Queue' },
  permitted: true,
  ...over,
});

/**
 * Runs `read` as a reader whose browser collates in `locale`.
 *
 * A browser resolves an argument-less `localeCompare` against the reader's
 * own locale. Node takes its default from the environment, which the runner
 * does not set, so the reader is simulated by giving a locale to the calls
 * that name none -- which is exactly the call these two sorts must not make.
 * A call that names its own locale is left alone, so pinning one is still a
 * fix rather than a failure.
 */
const asReaderLocale = <T>(locale: string, read: () => T): T => {
  const real = String.prototype.localeCompare;
  const forced = function forced(
    this: string,
    that: string,
    locales?: string | string[],
    options?: Intl.CollatorOptions,
  ): number {
    return real.call(this, that, locales ?? locale, options);
  };
  String.prototype.localeCompare =
    forced as typeof String.prototype.localeCompare;
  try {
    return read();
  } finally {
    String.prototype.localeCompare = real;
  }
};

// Four paths that three collations disagree about: Czech sorts `ch` after
// `h`, Danish sorts `aa` after `z`, and ASCII does neither. Arrival order is
// none of the three, so a sort has to be happening at all for any of these
// to pass.
const collated = [
  page({ name: 'Zones', path: '/zones', nav: { label: 'Zones' } }),
  page({ name: 'Review', path: '/chart-review', nav: { label: 'Review' } }),
  page({ name: 'Hub', path: '/hub', nav: { label: 'Hub' } }),
  page({ name: 'Aalborg', path: '/aalborg', nav: { label: 'Aalborg' } }),
];

test('a page opting into the nav is appended with its own path', () => {
  const result = withExtensionPages(menu as never, [page()]);

  expect(result).toHaveLength(2);
  expect(result[1]).toMatchObject({ label: 'Queue', url: '/review-queue' });
});

test('the page name is used when nav carries no label', () => {
  const result = withExtensionPages(menu as never, [page({ nav: {} })]);

  expect(result[1]).toMatchObject({ label: 'Review queue' });
});

test('contributed entries are ordered by path, not by arrival', () => {
  // Remote entries are injected in parallel and register as they finish, so
  // the registry's order is a network race. The bar has to read the same way
  // on every reload.
  const arrived = [
    page({ name: 'Lineage', path: '/data-lineage', nav: { label: 'Lineage' } }),
    page({ name: 'Queue', path: '/approvals', nav: { label: 'Approvals' } }),
    page({ name: 'Audit', path: '/review-log', nav: { label: 'Audit' } }),
  ];

  const order = (pages: ReturnType<typeof page>[]) =>
    withExtensionPages(menu as never, pages)
      .slice(menu.length)
      .map(item => item.url);

  expect(order(arrived)).toEqual([
    '/approvals',
    '/data-lineage',
    '/review-log',
  ]);
  expect(order([...arrived].reverse())).toEqual(order(arrived));
});

test("the bar reads the same whatever the reader's browser collates in", () => {
  // The cap turns a different order into a different bar rather than a
  // rearranged one: two of these keep a slot and the other two fold away
  // behind "More", so a Czech or Danish reader would be offered different
  // navigation from an English one.
  const bar = () =>
    withExtensionPages(menu as never, collated)
      .slice(menu.length)
      .map(item => ({
        name: (item as { name: string }).name,
        childs: (item.childs ?? []).map(c => (c as { name: string }).name),
      }));

  const expected = [
    { name: 'extension:/aalborg', childs: [] },
    { name: 'extension:/chart-review', childs: [] },
    { name: 'extension:more', childs: ['extension:/hub', 'extension:/zones'] },
  ];

  // Asserted against the order outright, not just against each other: the
  // runner's own default locale is one more thing that could move.
  expect(bar()).toEqual(expected);
  expect(asReaderLocale('cs', bar)).toEqual(expected);
  expect(asReaderLocale('da', bar)).toEqual(expected);
});

test('host entries keep their order and come first', () => {
  const hostMenu = [
    { label: 'Dashboards', name: 'Dashboards', url: '/dashboard/list/' },
    { label: 'Charts', name: 'Charts', url: '/chart/list/' },
  ];

  const result = withExtensionPages(hostMenu as never, [
    page({ path: '/approvals', nav: { label: 'Approvals' } }),
  ]);

  expect(result.map(item => item.name)).toEqual([
    'Dashboards',
    'Charts',
    'extension:/approvals',
  ]);
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
      page({
        nav: { label: 'Change review', category: 'Manage' },
        permitted: false,
      }),
    ]);

    expect(result.find(g => g.name === 'Manage')?.childs).toHaveLength(1);
  });

  test("a group's children are ordered by path, not by arrival either", () => {
    // Same race as the navbar: the registry hands these over in the order
    // their remote entries finished loading. Nothing folds in a Settings
    // group, so only the arrangement moves -- but it moves on every reload,
    // and with the reader's collation, for no reason at all.
    const children = () =>
      (
        withExtensionSettings(
          [{ name: 'Manage', label: 'Manage', childs: [] }] as never,
          [
            page({
              path: '/zones',
              nav: { label: 'Zones', category: 'Manage' },
            }),
            page({
              path: '/chart-review',
              nav: { label: 'Review', category: 'Manage' },
            }),
            page({ path: '/hub', nav: { label: 'Hub', category: 'Manage' } }),
            page({
              path: '/aalborg',
              nav: { label: 'Aalborg', category: 'Manage' },
            }),
          ],
        ).find(group => group.name === 'Manage')?.childs ?? []
      ).map(child => (child as { name: string }).name);

    const expected = [
      'extension:/aalborg',
      'extension:/chart-review',
      'extension:/hub',
      'extension:/zones',
    ];

    expect(children()).toEqual(expected);
    expect(asReaderLocale('cs', children)).toEqual(expected);
    expect(asReaderLocale('da', children)).toEqual(expected);
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

describe('under a subdirectory deployment', () => {
  // Every other `url` in this menu is already rooted -- the backend emits host
  // entries through `url_for` -- and `buildMenuItem` strips the root again
  // before handing the path to `NavLink`. A contributed entry has to follow
  // the same convention or it survives that round trip only by accident.
  test('a contributed entry carries the application root', () => {
    mockApplicationRoot.mockReturnValue('/analytics');

    const [entry] = withExtensionPages([] as never, [
      page({ path: '/review-queue', nav: { label: 'Queue' } }),
    ]);

    expect(entry.url).toBe('/analytics/review-queue');
  });

  test('a Settings child carries it too', () => {
    mockApplicationRoot.mockReturnValue('/analytics');

    const result = withExtensionSettings(
      [{ name: 'Manage', label: 'Manage', childs: [] }] as never,
      [
        page({
          path: '/approvals',
          nav: { label: 'Approvals', category: 'Manage' },
        }),
      ],
    );

    expect(result.find(g => g.name === 'Manage')?.childs?.[0]).toMatchObject({
      url: '/analytics/approvals',
    });
  });

  test('the root is applied exactly once, never twice', () => {
    mockApplicationRoot.mockReturnValue('/analytics');

    const [entry] = withExtensionPages([] as never, [
      page({ path: '/review-queue', nav: { label: 'Queue' } }),
    ]);

    expect(entry.url).not.toBe('/analytics/analytics/review-queue');
  });

  test('nothing is prefixed when the app serves from the domain root', () => {
    const [entry] = withExtensionPages([] as never, [
      page({ path: '/review-queue', nav: { label: 'Queue' } }),
    ]);

    expect(entry.url).toBe('/review-queue');
  });
});

describe('when more pages are contributed than the bar can hold', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      page({
        name: `Page ${i}`,
        path: `/page-${i}`,
        nav: { label: `Page ${i}` },
      }),
    );

  const names = (pages: ReturnType<typeof page>[]) =>
    withExtensionPages(menu as never, pages)
      .slice(menu.length)
      .map(item => item.name);

  test('three or fewer stay on the bar', () => {
    expect(names(many(3))).toEqual([
      'extension:/page-0',
      'extension:/page-1',
      'extension:/page-2',
    ]);
  });

  test('a fourth folds the tail into one dropdown', () => {
    // The dropdown costs a slot of its own, so two entries stay inline.
    expect(names(many(4))).toEqual([
      'extension:/page-0',
      'extension:/page-1',
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
      Array.from({ length: 8 }, (_, i) => `extension:/page-${i + 2}`),
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
      name: 'extension:/page-2',
      url: '/page-2',
    });
  });

  test('a page the user may not open is not folded in either', () => {
    const pages = [...many(4), page({ path: '/secret', permitted: false })];

    const [, , more] = withExtensionPages(menu as never, pages).slice(
      menu.length,
    );

    expect(
      more.childs?.some(c => (c as { url: string }).url === '/secret'),
    ).toBe(false);
  });
});
