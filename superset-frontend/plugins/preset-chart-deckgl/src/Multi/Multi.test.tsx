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
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DatasourceType, SupersetClient } from '@superset-ui/core';
import DeckMulti from './Multi';
import * as fitViewportModule from '../utils/fitViewport';

// Mock DeckGLContainer
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

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// register stub buildQuery/transformProps for the layer types the tests use.
// transformProps passes the mocked POST response's features straight through,
// so each test controls layer content via the POST mock, exactly as the real
// per-layer buildQuery/transformProps registry would.
const { getChartBuildQueryRegistry, getChartTransformPropsRegistry } =
  jest.requireActual('@superset-ui/core');
['deck_scatter', 'deck_polygon'].forEach(vizType => {
  getChartBuildQueryRegistry().registerValue(
    vizType,
    (formData: Record<string, unknown>) => ({
      datasource: 'test_datasource',
      queries: [{}],
      form_data: formData,
    }),
  );
  getChartTransformPropsRegistry().registerValue(
    vizType,
    (chartProps: any) => ({
      payload: {
        data: {
          features: chartProps.queriesData?.[0]?.data ?? [],
          mapboxApiKey: 'test-key',
          metricLabels: [],
        },
      },
    }),
  );
});

const mockStore = configureStore({
  reducer: {
    dataMask: () => ({}),
  },
});

// The two sub-slices every test in this file fetches: slice 1 is a scatter
// layer, slice 2 is a polygon layer -- mirroring the shape the old
// legacy-payload fixture hardcoded, but now resolved through the real
// GET /api/v1/chart/{id} -> POST /api/v1/chart/data v1 path.
const SUBSLICES: Record<number, { vizType: string }> = {
  1: { vizType: 'deck_scatter' },
  2: { vizType: 'deck_polygon' },
};

// Keyed by viz_type so a test can control exactly what features each layer's
// POST resolves with; defaults to empty so unconfigured layers are inert.
let featuresByVizType: Record<string, unknown[]> = {};

const mockFetchesFor = (subslices: Record<number, { vizType: string }>) => {
  (SupersetClient.get as jest.Mock).mockImplementation(
    ({ endpoint }: { endpoint: string }) => {
      const sliceId = Number(endpoint.match(/\/chart\/(\d+)/)?.[1]);
      const subslice = subslices[sliceId];
      return Promise.resolve({
        json: {
          result: {
            viz_type: subslice?.vizType,
            datasource_id: 1,
            datasource_type: 'table',
            params: JSON.stringify({
              viz_type: subslice?.vizType,
              datasource: 'test_datasource',
            }),
          },
        },
      });
    },
  );
  (SupersetClient.post as jest.Mock).mockImplementation(
    ({ jsonPayload }: { jsonPayload: { form_data: { viz_type: string } } }) =>
      Promise.resolve({
        json: {
          result: [
            { data: featuresByVizType[jsonPayload.form_data.viz_type] || [] },
          ],
        },
      }),
  );
};

const baseMockProps = {
  formData: {
    datasource: 'test_datasource',
    viz_type: 'deck_multi',
    deck_slices: [1, 2],
    autozoom: false,
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

const renderWithProviders = (component: React.ReactElement) =>
  render(
    <Provider store={mockStore}>
      <ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>
    </Provider>,
  );

describe('DeckMulti Autozoom Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    featuresByVizType = {};
    mockFetchesFor(SUBSLICES);
  });

  test('should NOT apply autozoom when autozoom is false', async () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    featuresByVizType = { deck_scatter: [{ position: [1, 1] }] };

    const props = {
      ...baseMockProps,
      formData: { ...baseMockProps.formData, autozoom: false },
    };

    renderWithProviders(<DeckMulti {...props} />);

    await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());
    expect(fitViewportSpy).not.toHaveBeenCalled();

    fitViewportSpy.mockRestore();
  });

  test('should apply autozoom to points fetched from each layer when autozoom is true', async () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    fitViewportSpy.mockReturnValue({
      longitude: -122.4,
      latitude: 37.8,
      zoom: 10,
    });
    featuresByVizType = {
      deck_scatter: [{ position: [1, 1] }, { position: [2, 2] }],
      deck_polygon: [
        {
          polygon: [
            [3, 3],
            [4, 4],
          ],
        },
      ],
    };

    const props = {
      ...baseMockProps,
      formData: { ...baseMockProps.formData, autozoom: true },
    };

    renderWithProviders(<DeckMulti {...props} />);

    await waitFor(() => {
      expect(fitViewportSpy).toHaveBeenCalledWith(
        expect.objectContaining({ longitude: 0, latitude: 0, zoom: 1 }),
        expect.objectContaining({
          width: 800,
          height: 600,
          points: expect.any(Array),
        }),
      );
    });
    // Points from both layers should have been collected by the time the
    // second (or later) refit happens -- this exercises the async, per-layer
    // accumulation added to fix the "autozoom dead in the v1 path" bug.
    const callWithBothLayers = fitViewportSpy.mock.calls.find(
      call => call[1].points.length >= 4,
    );
    expect(callWithBothLayers).toBeDefined();

    fitViewportSpy.mockRestore();
  });

  test('should refit as each layer arrives, even when they resolve out of order', async () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    fitViewportSpy.mockReturnValue({ longitude: 0, latitude: 0, zoom: 8 });

    // The polygon layer (slice 2) resolves before the scatter layer (slice 1),
    // the opposite of deck_slices order -- accumulation must not assume
    // layers arrive in request order.
    let resolveScatter: (value: unknown) => void = () => {};
    (SupersetClient.post as jest.Mock).mockImplementation(
      ({
        jsonPayload,
      }: {
        jsonPayload: { form_data: { viz_type: string } };
      }) => {
        if (jsonPayload.form_data.viz_type === 'deck_scatter') {
          return new Promise(resolve => {
            resolveScatter = resolve;
          });
        }
        return Promise.resolve({
          json: {
            result: [
              {
                data: [
                  {
                    polygon: [
                      [3, 3],
                      [4, 4],
                    ],
                  },
                ],
              },
            ],
          },
        });
      },
    );

    renderWithProviders(
      <DeckMulti
        {...baseMockProps}
        formData={{ ...baseMockProps.formData, autozoom: true }}
      />,
    );

    // Only the polygon layer's points have arrived so far.
    await waitFor(() => {
      const call = fitViewportSpy.mock.calls.at(-1);
      expect(call?.[1].points.length).toBe(2);
    });

    resolveScatter({
      json: {
        result: [{ data: [{ position: [1, 1] }, { position: [2, 2] }] }],
      },
    });

    // Once the scatter layer resolves, its points are added to the same
    // accumulator rather than replacing the polygon layer's.
    await waitFor(() => {
      const call = fitViewportSpy.mock.calls.at(-1);
      expect(call?.[1].points.length).toBe(4);
    });

    fitViewportSpy.mockRestore();
  });

  test('should set zoom to 0 when the fitted zoom is negative', async () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    fitViewportSpy.mockReturnValue({ longitude: 0, latitude: 0, zoom: -5 });
    featuresByVizType = { deck_scatter: [{ position: [1, 1] }] };

    renderWithProviders(
      <DeckMulti
        {...baseMockProps}
        formData={{ ...baseMockProps.formData, autozoom: true }}
      />,
    );

    await waitFor(() => {
      const container = screen.getByTestId('deckgl-container');
      const viewportData = JSON.parse(
        container.getAttribute('data-viewport') || '{}',
      );
      expect(viewportData.zoom).toBe(0);
    });

    fitViewportSpy.mockRestore();
  });

  test('should not refit when a layer resolves with no features', async () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');

    renderWithProviders(
      <DeckMulti
        {...baseMockProps}
        formData={{ ...baseMockProps.formData, autozoom: true }}
      />,
    );

    await waitFor(() => expect(SupersetClient.post).toHaveBeenCalledTimes(2));
    expect(fitViewportSpy).not.toHaveBeenCalled();

    fitViewportSpy.mockRestore();
  });

  test('should use the original viewport when autozoom is disabled', async () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    const originalViewport = { longitude: -100, latitude: 40, zoom: 5 };

    renderWithProviders(
      <DeckMulti
        {...baseMockProps}
        viewport={originalViewport}
        formData={{ ...baseMockProps.formData, autozoom: false }}
      />,
    );

    await waitFor(() => {
      const container = screen.getByTestId('deckgl-container');
      const viewportData = JSON.parse(
        container.getAttribute('data-viewport') || '{}',
      );
      expect(viewportData).toMatchObject(originalViewport);
    });
    expect(fitViewportSpy).not.toHaveBeenCalled();

    fitViewportSpy.mockRestore();
  });

  test('should apply autozoom when autozoom is undefined (backward compatibility)', async () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    fitViewportSpy.mockReturnValue({
      longitude: -122.4,
      latitude: 37.8,
      zoom: 10,
    });
    featuresByVizType = { deck_scatter: [{ position: [1, 1] }] };

    renderWithProviders(
      <DeckMulti
        {...baseMockProps}
        formData={{ ...baseMockProps.formData, autozoom: undefined }}
      />,
    );

    await waitFor(() => expect(fitViewportSpy).toHaveBeenCalled());

    fitViewportSpy.mockRestore();
  });
});

describe('DeckMulti stale-response guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    featuresByVizType = {};
    mockFetchesFor(SUBSLICES);
  });

  test('ignores a layer response that resolves after deck_slices has already changed again', async () => {
    let resolveSlice1Load: (value: unknown) => void = () => {};
    let resolveSlice2Load: (value: unknown) => void = () => {};
    (SupersetClient.post as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveSlice1Load = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveSlice2Load = resolve;
          }),
      )
      .mockImplementation(() =>
        Promise.resolve({ json: { result: [{ data: [] }] } }),
      );

    const { rerender } = renderWithProviders(<DeckMulti {...baseMockProps} />);

    await waitFor(() => expect(SupersetClient.post).toHaveBeenCalledTimes(2));

    // deck_slices changes to a single, different layer before the first
    // load's requests resolve -- this starts a new generation.
    rerender(
      <Provider store={mockStore}>
        <ThemeProvider theme={supersetTheme}>
          <DeckMulti
            {...baseMockProps}
            formData={{ ...baseMockProps.formData, deck_slices: [2] }}
          />
        </ThemeProvider>
      </Provider>,
    );

    await waitFor(() => expect(SupersetClient.post).toHaveBeenCalledTimes(3));

    // The abandoned first-generation slice-1 and slice-2 responses now
    // resolve. If they were not ignored, the container would show 2 layers
    // (the stale slice 1 and 2) instead of just the current generation's 1.
    resolveSlice1Load({ json: { result: [{ data: [] }] } });
    resolveSlice2Load({ json: { result: [{ data: [] }] } });

    await waitFor(() => {
      expect(
        screen
          .getByTestId('deckgl-container')
          .getAttribute('data-layers-count'),
      ).toBe('1');
    });
  });
});

describe('DeckMulti Component Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    featuresByVizType = {};
    mockFetchesFor(SUBSLICES);
  });

  test('should render DeckGLContainer', async () => {
    renderWithProviders(<DeckMulti {...baseMockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('deckgl-container')).toBeInTheDocument();
    });
  });

  test('should pass the base viewport through to DeckGLContainer', async () => {
    renderWithProviders(<DeckMulti {...baseMockProps} />);

    await waitFor(() => {
      const container = screen.getByTestId('deckgl-container');
      const viewportData = JSON.parse(
        container.getAttribute('data-viewport') || '{}',
      );

      expect(viewportData).toMatchObject({
        longitude: baseMockProps.viewport.longitude,
        latitude: baseMockProps.viewport.latitude,
        zoom: baseMockProps.viewport.zoom,
      });
    });
  });

  test('should include dashboardId in child slice requests when present', async () => {
    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        dashboardId: 123, // Simulate embedded dashboard context
      },
    };

    renderWithProviders(<DeckMulti {...props} />);

    await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());

    const { calls } = (SupersetClient.post as jest.Mock).mock;
    calls.forEach(call => {
      const formData = call[0].jsonPayload?.form_data || {};
      expect(formData.dashboardId).toBe(123);
    });
  });

  test('should not include dashboardId when not present', async () => {
    renderWithProviders(<DeckMulti {...baseMockProps} />);

    await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());

    const { calls } = (SupersetClient.post as jest.Mock).mock;
    calls.forEach(call => {
      const formData = call[0].jsonPayload?.form_data || {};
      expect(formData.dashboardId).toBeUndefined();
    });
  });

  test('should preserve dashboardId through filter updates', async () => {
    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        dashboardId: 456,
        extra_filters: [{ col: 'test', op: 'IN' as const, val: ['value'] }],
      },
    };

    renderWithProviders(<DeckMulti {...props} />);

    await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());

    const { calls } = (SupersetClient.post as jest.Mock).mock;
    calls.forEach(call => {
      const formData = call[0].jsonPayload?.form_data || {};
      expect(formData.dashboardId).toBe(456);
      expect(formData.extra_filters).toBeDefined();
    });
  });

  test('should reload layers when deck_slices changes', async () => {
    const { rerender } = renderWithProviders(<DeckMulti {...baseMockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('deckgl-container')).toBeInTheDocument();
    });
    expect(SupersetClient.get).toHaveBeenCalledTimes(2);

    rerender(
      <Provider store={mockStore}>
        <ThemeProvider theme={supersetTheme}>
          <DeckMulti
            {...baseMockProps}
            formData={{ ...baseMockProps.formData, deck_slices: [1, 2, 3] }}
          />
        </ThemeProvider>
      </Provider>,
    );

    await waitFor(() => expect(SupersetClient.get).toHaveBeenCalledTimes(5));
  });
});

test('includes parent_slice_id in child slice requests when parent has slice_id', async () => {
  jest.clearAllMocks();
  featuresByVizType = {};
  mockFetchesFor(SUBSLICES);
  const parentSliceId = 99;
  const dashboardId = 5;

  const props = {
    ...baseMockProps,
    formData: {
      ...baseMockProps.formData,
      slice_id: parentSliceId,
      dashboardId,
    },
  };

  renderWithProviders(<DeckMulti {...props} />);

  await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());

  const { calls } = (SupersetClient.post as jest.Mock).mock;
  calls.forEach(call => {
    const formData = call[0].jsonPayload?.form_data || {};
    expect(formData).toMatchObject({
      dashboardId,
      parent_slice_id: parentSliceId,
    });
  });
});

test('includes parent_slice_id in embedded mode', async () => {
  jest.clearAllMocks();
  featuresByVizType = {};
  mockFetchesFor(SUBSLICES);
  const parentSliceId = 200;
  const dashboardId = 10;

  const props = {
    ...baseMockProps,
    formData: {
      ...baseMockProps.formData,
      slice_id: parentSliceId,
      dashboardId,
      embedded: true,
    },
  };

  renderWithProviders(<DeckMulti {...props} />);

  await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());

  const { calls } = (SupersetClient.post as jest.Mock).mock;
  calls.forEach(call => {
    const formData = call[0].jsonPayload?.form_data || {};
    expect(formData.parent_slice_id).toBe(parentSliceId);
  });
});

test('does not include parent_slice_id when parent has no slice_id', async () => {
  jest.clearAllMocks();
  featuresByVizType = {};
  mockFetchesFor(SUBSLICES);

  const props = {
    ...baseMockProps,
    formData: {
      ...baseMockProps.formData,
      dashboardId: 5,
    },
  };

  renderWithProviders(<DeckMulti {...props} />);

  await waitFor(() => expect(SupersetClient.post).toHaveBeenCalled());

  const { calls } = (SupersetClient.post as jest.Mock).mock;
  calls.forEach(call => {
    const formData = call[0].jsonPayload?.form_data || {};
    expect(formData.parent_slice_id).toBeUndefined();
  });
});

test('falls back to a per-chart read for a layer missing from the persisted deck_slices', async () => {
  // A saved container's `deck_slices` on the server can lag the in-memory
  // Explore selection (e.g. layer 3 was just added but not saved yet), so
  // the bulk deck_layers response only resolves layers 1 and 2. Layer 3
  // must still be fetched (and previewed) via a per-chart read rather than
  // silently dropped until the chart is saved.
  jest.clearAllMocks();
  featuresByVizType = {};
  const parentSliceId = 50;

  (SupersetClient.get as jest.Mock).mockImplementation(
    ({ endpoint }: { endpoint: string }) => {
      if (endpoint === `/api/v1/chart/${parentSliceId}/deck_layers/`) {
        return Promise.resolve({
          json: {
            result: [1, 2].map(sliceId => ({
              slice_id: sliceId,
              viz_type: SUBSLICES[sliceId].vizType,
              datasource_id: 1,
              datasource_type: 'table',
              params: JSON.stringify({
                viz_type: SUBSLICES[sliceId].vizType,
                datasource: 'test_datasource',
              }),
            })),
          },
        });
      }
      const subslice = { vizType: 'deck_scatter' };
      return Promise.resolve({
        json: {
          result: {
            viz_type: subslice.vizType,
            datasource_id: 1,
            datasource_type: 'table',
            params: JSON.stringify({
              viz_type: subslice.vizType,
              datasource: 'test_datasource',
            }),
          },
        },
      });
    },
  );
  (SupersetClient.post as jest.Mock).mockImplementation(
    ({ jsonPayload }: { jsonPayload: { form_data: { viz_type: string } } }) =>
      Promise.resolve({
        json: {
          result: [
            { data: featuresByVizType[jsonPayload.form_data.viz_type] || [] },
          ],
        },
      }),
  );

  const props = {
    ...baseMockProps,
    formData: {
      ...baseMockProps.formData,
      slice_id: parentSliceId,
      deck_slices: [1, 2, 3],
    },
  };

  renderWithProviders(<DeckMulti {...props} />);

  await waitFor(() =>
    expect(SupersetClient.get).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/chart/3' }),
    ),
  );
  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: `/api/v1/chart/${parentSliceId}/deck_layers/`,
    }),
  );
  expect(SupersetClient.get).not.toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: '/api/v1/chart/1' }),
  );
  expect(SupersetClient.get).not.toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: '/api/v1/chart/2' }),
  );
});
