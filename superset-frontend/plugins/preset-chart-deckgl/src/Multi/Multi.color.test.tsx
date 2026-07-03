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
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DatasourceType, SupersetClient } from '@superset-ui/core';
import DeckMulti from './Multi';

// Capture the layers handed to the DeckGL container so we can inspect the
// per-feature colors that were resolved for each sublayer.
interface CapturedDataPoint {
  color: number[];
}
interface CapturedLayer {
  id?: string;
  props: {
    data: CapturedDataPoint[];
    getSourceColor?: (d: Record<string, unknown>) => number[];
    getTargetColor?: (d: Record<string, unknown>) => number[];
  };
}
const mockLayerCapture: { layers: CapturedLayer[] } = { layers: [] };
jest.mock('../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: ({ layers }: { layers?: CapturedLayer[] }) => {
    mockLayerCapture.layers = layers || [];
    return <div data-test="deckgl-container">DeckGL Container Mock</div>;
  },
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
}));

const mockStore = configureStore({
  reducer: {
    dataMask: () => ({}),
  },
});

const renderWithProviders = (component: React.ReactElement) =>
  render(
    <Provider store={mockStore}>
      <ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>
    </Provider>,
  );

const SCATTER_SLICE_ID = 1;

const props = {
  formData: {
    datasource: '1__table',
    viz_type: 'deck_multi',
    deck_slices: [SCATTER_SLICE_ID],
    autozoom: false,
    map_style: 'mapbox://styles/mapbox/light-v9',
  },
  payload: {
    data: {
      slices: [
        {
          slice_id: SCATTER_SLICE_ID,
          form_data: {
            viz_type: 'deck_scatter',
            datasource: '1__table',
            slice_id: SCATTER_SLICE_ID,
            // categorical color configuration coming from the saved scatter chart
            color_scheme_type: 'categorical_palette',
            color_scheme: 'supersetColors',
            dimension: 'category',
          },
        },
      ],
      features: {
        deck_scatter: [],
      },
      mapboxApiKey: 'test-key',
    },
  },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockLayerCapture.layers = [];
  // The scatter sublayer query returns features tagged with a category column.
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      data: {
        features: [
          { position: [0, 0], radius: 1, cat_color: 'A' },
          { position: [1, 1], radius: 1, cat_color: 'B' },
        ],
      },
    },
  });
});

const expectDistinctCategoricalColors = async () => {
  await waitFor(() => {
    expect(mockLayerCapture.layers.length).toBeGreaterThan(0);
  });

  const scatterLayer = mockLayerCapture.layers.find((layer: CapturedLayer) =>
    layer?.id?.startsWith('scatter-layer-'),
  );
  expect(scatterLayer).toBeDefined();

  const { data } = (scatterLayer as CapturedLayer).props;
  expect(data).toHaveLength(2);

  // Both points must carry a resolved RGBA color...
  data.forEach((d: CapturedDataPoint) => {
    expect(Array.isArray(d.color)).toBe(true);
    expect(d.color).toHaveLength(4);
  });

  // ...and the two distinct categories must NOT share the same color. Before
  // the fix, categorical colors were dropped in the Multiple Layers chart and
  // every point fell back to the same default color.
  expect(data[0].color).not.toEqual(data[1].color);
};

test('applies categorical scatterplot colors to sublayers in the multi chart', async () => {
  renderWithProviders(<DeckMulti {...props} />);

  await expectDistinctCategoricalColors();
});

test('applies categorical colors to scatter subslices saved before the color_scheme_type control existed', async () => {
  // Charts saved before the color_scheme_type control existed lack the key in
  // stored params; the scatter default (categorical_palette) must be resolved
  // so they keep per-category colors.
  const legacyProps = {
    ...props,
    payload: {
      ...props.payload,
      data: {
        ...props.payload.data,
        slices: [
          {
            slice_id: SCATTER_SLICE_ID,
            form_data: {
              viz_type: 'deck_scatter',
              datasource: '1__table',
              slice_id: SCATTER_SLICE_ID,
              color_scheme: 'supersetColors',
              dimension: 'category',
            },
          },
        ],
      },
    },
  };

  renderWithProviders(<DeckMulti {...legacyProps} />);

  await expectDistinctCategoricalColors();
});

test('keeps fixed source and target colors for arc subslices saved before the color_scheme_type control existed', async () => {
  // Legacy arcs default to fixed_color, where the layer reads the source and
  // target pickers directly; resolving the default must not stamp a single
  // per-feature color over the target color.
  const ARC_SLICE_ID = 2;
  const arcProps = {
    ...props,
    formData: { ...props.formData, deck_slices: [ARC_SLICE_ID] },
    payload: {
      ...props.payload,
      data: {
        ...props.payload.data,
        slices: [
          {
            slice_id: ARC_SLICE_ID,
            form_data: {
              viz_type: 'deck_arc',
              datasource: '1__table',
              slice_id: ARC_SLICE_ID,
              color_picker: { r: 10, g: 20, b: 30, a: 1 },
              target_color_picker: { r: 40, g: 50, b: 60, a: 1 },
            },
          },
        ],
        features: { deck_arc: [] },
      },
    },
  };
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      data: {
        features: [{ sourcePosition: [0, 0], targetPosition: [1, 1] }],
      },
    },
  });

  renderWithProviders(<DeckMulti {...arcProps} />);

  await waitFor(() => {
    expect(mockLayerCapture.layers.length).toBeGreaterThan(0);
  });

  const arcLayer = mockLayerCapture.layers.find(
    (layer: CapturedLayer) => layer?.id === `path-layer-${ARC_SLICE_ID}`,
  );
  expect(arcLayer).toBeDefined();

  expect(arcLayer?.props.getSourceColor?.({})).toEqual([10, 20, 30, 255]);
  expect(arcLayer?.props.getTargetColor?.({})).toEqual([40, 50, 60, 255]);
});
