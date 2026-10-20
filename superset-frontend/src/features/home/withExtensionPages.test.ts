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

import { withExtensionPages } from './Menu';

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
