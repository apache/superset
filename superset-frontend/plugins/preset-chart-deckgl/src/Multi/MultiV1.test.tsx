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
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/theme';
import { DatasourceType, SupersetClient } from '@superset-ui/core';
import DeckMulti from './Multi';

jest.mock('../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: ({ viewport, layers }: any) => (
    <div
      data-test="deckgl-container"
      data-viewport={JSON.stringify(viewport)}
      data-layers-count={layers?.length || 0}
    >
      DeckGL Container Mock
    </div>
  ),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: { get: jest.fn(), post: jest.fn() },
}));

// San Francisco coordinates so the fitted viewport is far from the default (0,0).
const SF_FEATURES = [
  { position: [-122.4, 37.8] },
  { position: [-122.42, 37.77] },
];

const { getChartBuildQueryRegistry, getChartTransformPropsRegistry } =
  jest.requireActual('@superset-ui/core');
getChartBuildQueryRegistry().registerValue('deck_scatter', (fd: any) => ({
  datasource: fd.datasource,
  queries: [{}],
  form_data: fd,
}));
getChartTransformPropsRegistry().registerValue('deck_scatter', () => ({
  payload: { data: { features: SF_FEATURES } },
}));

const store = configureStore({ reducer: { dataMask: () => ({}) } });

// The v1 path: deck_multi issues no query of its own, so payload (queriesData[0])
// is undefined and each layer is fetched from its saved chart client-side.
const v1Props: any = {
  formData: {
    datasource: 'test_datasource',
    viz_type: 'deck_multi',
    deck_slices: [1],
    autozoom: true,
    map_style: 'mapbox://styles/mapbox/light-v9',
  },
  payload: undefined,
  setControlValue: jest.fn(),
  viewport: { longitude: 0, latitude: 0, zoom: 1 },
  onAddFilter: jest.fn(),
  height: 600,
  width: 800,
  datasource: {
    id: 1,
    type: DatasourceType.Table,
    name: 'test_datasource',
    columns: [],
    metrics: [],
    columnFormats: {},
    currencyFormats: {},
    verboseMap: {},
  },
  onSelect: jest.fn(),
};

const renderV1 = () =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={supersetTheme}>
        <DeckMulti {...v1Props} />
      </ThemeProvider>
    </Provider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      result: {
        viz_type: 'deck_scatter',
        // The chart's authoritative datasource, which differs from the stale
        // value baked into params below.
        datasource_id: 42,
        datasource_type: 'table',
        params: JSON.stringify({
          viz_type: 'deck_scatter',
          datasource: '5__table',
        }),
      },
    },
  });
  (SupersetClient.post as jest.Mock).mockResolvedValue({
    json: { result: [{ data: SF_FEATURES }] },
  });
});

test('fetches the saved sub-slice and renders its layer (v1 path)', async () => {
  renderV1();

  await waitFor(() => expect(SupersetClient.get).toHaveBeenCalled());
  await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.getByTestId('deckgl-container').getAttribute('data-layers-count'),
    ).toBe('1'),
  );
});

test('queries the layer against the chart real datasource, not the stale params one', async () => {
  renderV1();

  // The saved params say "5__table" but the chart is bound to
  // datasource_id 42; the layer query must use the authoritative "42__table"
  // so it hits the dataset that actually has the layer's columns.
  await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());
  const payload = (SupersetClient.post as jest.Mock).mock.calls[0][0]
    .jsonPayload;
  expect(payload.form_data.datasource).toBe('42__table');
  expect(payload.datasource).toBe('42__table');
});

test('fits the viewport to the fetched layer data when autozoom is on (v1 path)', async () => {
  renderV1();

  // The initial viewport has no data to fit to (payload is empty in v1), so it
  // starts at the default. Once the layer's features arrive it should recenter
  // near the data (San Francisco), not stay at (0, 0).
  await waitFor(() => {
    const viewport = JSON.parse(
      screen.getByTestId('deckgl-container').getAttribute('data-viewport') ||
        '{}',
    );
    expect(viewport.longitude).toBeLessThan(-100);
    expect(viewport.latitude).toBeGreaterThan(30);
  });
});
