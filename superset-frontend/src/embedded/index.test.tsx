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
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';

jest.mock('src/public-path', () => ({}));

jest.mock('query-string', () => ({}));

jest.mock('@superset-ui/core/components/ThemedAgGridReact', () => ({
  setupAGGridModules: jest.fn(),
}));

jest.mock('src/preamble', () => jest.fn().mockResolvedValue(true));

jest.mock('src/setup/setupPlugins', () => jest.fn(), { virtual: true });

jest.mock('src/setup/setupCodeOverrides', () => jest.fn(), { virtual: true });

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    embedded: { dashboard_id: '123' },
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

describe('embedded/index.tsx', () => {
  beforeAll(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  test('initializes AG Grid modules on bootstrap', async () => {
    require('./index');

    // index.tsx uses initPreamble().then(...) to initialize plugins and AG grid
    // Wait for the promise chain to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(setupAGGridModules).toHaveBeenCalled();
  });
});
