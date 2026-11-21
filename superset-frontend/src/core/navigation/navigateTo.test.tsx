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
import { MemoryRouter, Route } from 'react-router-dom';
import { act, render } from 'spec/helpers/testing-library';
import { commands } from '../commands';
import { navigation, OPEN_PAGE_COMMAND, useNavigationTracker } from './index';

let currentPath = '';

const Tracker = () => {
  useNavigationTracker();
  return null;
};

const renderRouter = () =>
  render(
    <MemoryRouter initialEntries={['/welcome/']}>
      <Tracker />
      <Route
        render={({ location }) => {
          currentPath = `${location.pathname}${location.search}`;
          return null;
        }}
      />
    </MemoryRouter>,
  );

test('navigateTo pushes client-side routes through the router history', () => {
  renderRouter();
  const seen: Array<{ pathname: string; search: string }> = [];
  const sub = navigation.onDidChangeLocation(loc => seen.push(loc));

  act(() =>
    navigation.navigateTo('/extensions/pages/acme.catalog.main/42?tab=a'),
  );

  expect(currentPath).toBe('/extensions/pages/acme.catalog.main/42?tab=a');
  expect(navigation.getLocation()).toEqual({
    pathname: '/extensions/pages/acme.catalog.main/42',
    search: '?tab=a',
  });
  expect(seen.at(-1)).toEqual(navigation.getLocation());
  expect(navigation.getPage()).toBe('extension');
  sub.dispose();
});

test('core.navigation.openPage opens an extension page by id', async () => {
  renderRouter();

  await act(async () => {
    await commands.executeCommand(OPEN_PAGE_COMMAND, 'acme.catalog.main');
  });
  expect(currentPath).toBe('/extensions/pages/acme.catalog.main');

  await expect(
    commands.executeCommand(OPEN_PAGE_COMMAND, '../dashboard/list'),
  ).rejects.toThrow(/expects a page id/);
});
