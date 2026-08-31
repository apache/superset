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
// Mark this file as a module so its top-level declarations stay file-scoped
// (the file has no imports; modules are loaded via require() inside tests).
export {};

// Stable mock references so they survive jest.resetModules() between tests
// (a factory-created jest.fn() would otherwise be replaced on each reset,
// leaving these imported handles pointing at a stale instance).
const mockSetupAGGridModules = jest.fn();
const mockLogging = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock('src/public-path', () => ({}));

jest.mock('query-string', () => ({}));

jest.mock('@superset-ui/core/components/ThemedAgGridReact', () => ({
  setupAGGridModules: mockSetupAGGridModules,
}));

jest.mock('@apache-superset/core/utils', () => ({
  logging: mockLogging,
}));

// setupPlugins is driven per-test so the retry path can force a rejection.
const mockSetupPlugins = jest.fn();
jest.mock('src/setup/setupPlugins', () => mockSetupPlugins, { virtual: true });

jest.mock('src/setup/setupCodeOverrides', () => jest.fn(), { virtual: true });

jest.mock('src/preamble', () => jest.fn().mockResolvedValue(true));

// makeApi returns a callable that resolves with the current user roles.
const mockGetMeWithRole = jest.fn();
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  makeApi: () => mockGetMeWithRole,
}));

jest.mock('src/components/UiConfigContext', () => ({
  useUiConfig: () => ({}),
}));

// Capture the guestToken handler that start() is wired to, so tests can
// re-trigger the handshake and assert the retry behavior.
const mockSwitchboard = {
  handler: undefined as ((arg: { guestToken: string }) => void) | undefined,
};
jest.mock('@superset-ui/switchboard', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    start: jest.fn(),
    defineMethod: (name: string, fn: (arg: { guestToken: string }) => void) => {
      if (name === 'guestToken') {
        mockSwitchboard.handler = fn;
      }
    },
    emit: jest.fn(),
  },
}));

jest.mock('src/setup/setupClient', () => jest.fn(), { virtual: true });

jest.mock('src/views/store', () => ({
  store: {
    dispatch: jest.fn(),
    getState: () => ({ dataMask: {} }),
    subscribe: jest.fn(),
  },
  USER_LOADED: 'USER_LOADED',
}));

jest.mock('src/components/MessageToasts/actions', () => ({
  addDangerToast: jest.fn(() => ({ type: 'ADD_TOAST' })),
}));

jest.mock('src/components', () => ({ ErrorBoundary: () => null }));

jest.mock('src/components/MessageToasts/ToastContainer', () => () => null);

jest.mock('./EmbeddedContextProviders', () => ({
  EmbeddedContextProviders: () => null,
  getThemeController: () => null,
}));

jest.mock('./api', () => ({ embeddedApi: {} }));

jest.mock('./originValidation', () => ({ validateMessageEvent: () => true }));

jest.mock('./utils', () => ({ getDataMaskChangeTrigger: () => ({}) }));

jest.mock('react-dom/client', () => ({
  createRoot: () => ({ render: jest.fn(), unmount: jest.fn() }),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    embedded: { dashboard_id: '123', allowed_domains: [] },
    common: {
      application_root: '/',
      static_assets_prefix: '/',
      conf: {
        SQLLAB_DEFAULT_DBID: 1,
        DEFAULT_SQLLAB_LIMIT: 1000,
      },
    },
  }),
  applicationRoot: () => '/',
  staticAssetsPrefix: () => '/',
}));

const flush = async () => {
  // Several microtask hops: initPreamble -> dynamic import() -> setup calls.
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

// Drive the postMessage handshake so index.tsx registers its Switchboard methods.
// jsdom lacks MessageChannel, so a minimal fake port is enough here.
function sendHandshake() {
  const port = {} as MessagePort;
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { handshake: 'port transfer' },
      ports: [port],
    }),
  );
}

describe('embedded/index.tsx', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSwitchboard.handler = undefined;
    mockSetupPlugins.mockReset();
    mockSetupAGGridModules.mockReset();
    mockLogging.error.mockClear();
    mockGetMeWithRole.mockReset();
    mockGetMeWithRole.mockResolvedValue({ result: { roles: {} } });
    document.body.innerHTML = '<div id="app"></div>';
  });

  test('initializes AG Grid modules on bootstrap', async () => {
    mockSetupPlugins.mockImplementation(() => undefined);
    require('./index');
    await flush();

    expect(mockSetupAGGridModules).toHaveBeenCalled();
  });

  test('retries plugin setup after setupPlugins rejects, then bootstraps the user', async () => {
    // First plugin setup throws; the second attempt (after a re-handshake) succeeds.
    mockSetupPlugins
      .mockImplementationOnce(() => {
        throw new Error('setupPlugins failed');
      })
      .mockImplementation(() => undefined);

    require('./index');
    await flush();

    sendHandshake();
    expect(mockSwitchboard.handler).toBeDefined();

    // First guest token: plugin setup rejects, start() resets the guard and
    // recreates pluginsReady so a retry can re-run setup.
    mockSwitchboard.handler!({ guestToken: 'token-1' });
    await flush();
    expect(mockLogging.error).toHaveBeenCalled();
    expect(mockGetMeWithRole).not.toHaveBeenCalled();
    // The user gets a visible failure message rather than a blank #app.
    expect(document.getElementById('app')!.innerHTML).toContain(
      'Something went wrong loading the dashboard',
    );

    // Second guest token retries: plugin setup now succeeds and the user loads.
    mockSwitchboard.handler!({ guestToken: 'token-2' });
    await flush();
    expect(mockSetupPlugins).toHaveBeenCalledTimes(2);
    expect(mockGetMeWithRole).toHaveBeenCalled();
  });
});
