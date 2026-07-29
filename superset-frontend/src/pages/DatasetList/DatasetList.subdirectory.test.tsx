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
import { act, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { render } from 'spec/helpers/testing-library';

// DatasetList statically imports applicationRoot(); intercept it so we can
// simulate a subdirectory deployment. Mirrors the Tab.subdirectory pattern.
const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    default: actual.default,
    applicationRoot: () => mockApplicationRoot(),
    staticAssetsPrefix: actual.staticAssetsPrefix,
  };
});

// eslint-disable-next-line import/first
import DatasetList from 'src/pages/DatasetList';
// eslint-disable-next-line import/first
import {
  setupMocks,
  mockDatasetListEndpoints,
  mockAdminUser,
  mockDatasets,
  createMockStore,
  createDefaultStoreState,
} from './DatasetList.testHelpers';

const APP_ROOT = '/superset';

const renderUnderSubdirectory = () => {
  const store = createMockStore({
    ...createDefaultStoreState(mockAdminUser),
    user: mockAdminUser,
  });
  return render(
    <Provider store={store}>
      {/* Mirror production's `<Router basename={applicationRoot()}>`
          (views/App.tsx). BrowserRouter honours basename in createHref, so a
          router-relative `to` is re-prefixed once — exactly the seam the strip
          must feed correctly. */}
      <BrowserRouter basename={APP_ROOT}>
        <QueryParamProvider adapter={ReactRouter5Adapter}>
          <DatasetList user={mockAdminUser} />
        </QueryParamProvider>
      </BrowserRouter>
    </Provider>,
  );
};

beforeEach(() => {
  setupMocks();
  mockApplicationRoot.mockReturnValue(APP_ROOT);
  // Put the page URL under the basename so BrowserRouter is consistent.
  window.history.replaceState({}, '', `${APP_ROOT}/tablemodelview/list/`);
});

afterEach(async () => {
  jest.useRealTimers();
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  window.history.replaceState({}, '', '/');
  fetchMock.clearHistory().removeRoutes();
  jest.restoreAllMocks();
});

test('explore link is single-prefixed under a subdirectory deployment', async () => {
  // The backend emits explore_url already carrying the application root. The
  // Router basename re-prefixes the root, so the strip must run first to avoid
  // a doubled /superset/superset/... href.
  const dataset = {
    ...mockDatasets[0],
    explore_url: `${APP_ROOT}/explore/?datasource=1__table`,
  };
  mockDatasetListEndpoints({ result: [dataset], count: 1 });

  renderUnderSubdirectory();

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const exploreLink = screen.getByRole('link', { name: dataset.table_name });
  expect(exploreLink).toHaveAttribute(
    'href',
    `${APP_ROOT}/explore/?datasource=1__table`,
  );
  expect(exploreLink.getAttribute('href')).not.toContain('/superset/superset');
});

test('external default_endpoint passes through unprefixed', async () => {
  const dataset = {
    ...mockDatasets[0],
    explore_url: 'https://external.example.com/custom-endpoint',
  };
  mockDatasetListEndpoints({ result: [dataset], count: 1 });

  renderUnderSubdirectory();

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const exploreLink = screen.getByRole('link', { name: dataset.table_name });
  expect(exploreLink.getAttribute('href')).toMatch(
    /^https:\/\/external\.example\.com\/custom-endpoint/,
  );
});
