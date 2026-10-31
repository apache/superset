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
import { act, render, screen } from 'spec/helpers/testing-library';
import { views } from 'src/core/views';
import { RoutePaths } from 'src/views/routePaths';
import ExtensionView from '.';

const mockInitializeExtensions = jest.fn<Promise<void>, []>();

jest.mock('src/extensions/ExtensionsLoader', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      initializeExtensions: () => mockInitializeExtensions(),
    }),
  },
}));

const disposables: Array<{ dispose: () => void }> = [];

beforeEach(() => {
  mockInitializeExtensions.mockResolvedValue(undefined);
});

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Route path={RoutePaths.EXTENSION_VIEW} component={ExtensionView} />
    </MemoryRouter>,
    { useTheme: true },
  );

test('resolves a view id that spans multiple path segments', () => {
  disposables.push(
    views.registerView(
      { id: 'my-ext/settings', name: 'My Settings' },
      'global.settingsPanel',
      () => <div>Settings Content</div>,
    ),
  );

  renderAt('/extensions/view/my-ext/settings');

  expect(screen.getByText('Settings Content')).toBeInTheDocument();
});

test('resolves a view id whose slash is percent-encoded in the URL', () => {
  disposables.push(
    views.registerView(
      { id: 'my-ext/encoded', name: 'My Settings' },
      'global.settingsPanel',
      () => <div>Encoded Content</div>,
    ),
  );

  renderAt('/extensions/view/my-ext%2Fencoded');

  expect(screen.getByText('Encoded Content')).toBeInTheDocument();
});

test('resolves a view id containing a percent sign navigated to via encodeURIComponent', () => {
  const id = 'my-ext/rate%';
  disposables.push(
    views.registerView({ id, name: 'Rate' }, 'global.settingsPanel', () => (
      <div>Percent Content</div>
    )),
  );

  renderAt(`/extensions/view/${encodeURIComponent(id)}`);

  expect(screen.getByText('Percent Content')).toBeInTheDocument();
});

test('uses the registered view name as the page heading', () => {
  disposables.push(
    views.registerView(
      { id: 'my-ext.named', name: 'Named Screen' },
      'global.settingsPanel',
      () => <div>Named Content</div>,
    ),
  );

  renderAt('/extensions/view/my-ext.named');

  expect(screen.getByText('Named Screen')).toBeInTheDocument();
  expect(screen.queryByText('Extension')).not.toBeInTheDocument();
});

test('shows a loading state until extensions settle, then the placeholder', async () => {
  let settle: () => void = () => {};
  mockInitializeExtensions.mockReturnValue(
    new Promise<void>(resolve => {
      settle = resolve;
    }),
  );

  renderAt('/extensions/view/my-ext.missing');

  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  expect(screen.getByText('Extension')).toBeInTheDocument();
  expect(
    screen.queryByText('The extension my-ext.missing could not be loaded.'),
  ).not.toBeInTheDocument();

  await act(async () => {
    settle();
  });

  expect(
    screen.getByText('The extension my-ext.missing could not be loaded.'),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
});

test('shows the view as soon as it registers, even before extensions settle', () => {
  mockInitializeExtensions.mockReturnValue(new Promise<void>(() => {}));

  renderAt('/extensions/view/my-ext.late');

  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

  act(() => {
    disposables.push(
      views.registerView(
        { id: 'my-ext.late', name: 'Late Screen' },
        'global.settingsPanel',
        () => <div>Late Content</div>,
      ),
    );
  });

  expect(screen.getByText('Late Content')).toBeInTheDocument();
  expect(screen.getByText('Late Screen')).toBeInTheDocument();
  expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
});
