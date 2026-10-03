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
import { render, screen } from 'spec/helpers/testing-library';
import { views } from 'src/core/views';
import { RoutePaths } from 'src/views/routePaths';
import ExtensionView from '.';

test('resolves a view id that spans multiple path segments', () => {
  const disposable = views.registerView(
    { id: 'my-ext/settings', name: 'My Settings' },
    'global.settingsPanel',
    () => <div>Settings Content</div>,
  );

  render(
    <MemoryRouter initialEntries={['/extensions/view/my-ext/settings']}>
      <Route path={RoutePaths.EXTENSION_VIEW} component={ExtensionView} />
    </MemoryRouter>,
    { useTheme: true },
  );

  expect(screen.getByText('Settings Content')).toBeInTheDocument();

  disposable.dispose();
});

test('resolves a view id whose slash is percent-encoded in the URL', () => {
  const disposable = views.registerView(
    { id: 'my-ext/encoded', name: 'My Settings' },
    'global.settingsPanel',
    () => <div>Encoded Content</div>,
  );

  render(
    <MemoryRouter initialEntries={['/extensions/view/my-ext%2Fencoded']}>
      <Route path={RoutePaths.EXTENSION_VIEW} component={ExtensionView} />
    </MemoryRouter>,
    { useTheme: true },
  );

  expect(screen.getByText('Encoded Content')).toBeInTheDocument();

  disposable.dispose();
});
