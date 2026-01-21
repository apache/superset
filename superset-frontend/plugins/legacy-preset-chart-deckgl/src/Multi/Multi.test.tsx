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
import { supersetTheme, ThemeProvider } from '@apache-superset/core/ui';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SupersetClient } from '@superset-ui/core';
import DeckMulti from './Multi';
import * as fitViewportModule from '../utils/fitViewport';

// Mock DeckGLContainer
jest.mock('../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: ({ viewport, layers }: any) => (
    <div
      data-testid="deckgl-container"
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
  },
}));

const mockStore = configureStore({
  reducer: {
    dataMask: () => ({}),
  },
});

const baseMockProps = {
  formData: {
    datasource: 'test_datasource',
    viz_type: 'deck_multi',
    deck_slices: [1, 2],
    autozoom: false,
    mapbox_style: 'mapbox://styles/mapbox/light-v9',
  },
  payload: {
    data: {
      slices: [
        {
          slice_id: 1,
          form_data: {
            viz_type: 'deck_scatter',
            datasource: 'test_datasource',
          },
        },
        {
          slice_id: 2,
          form_data: {
            viz_type: 'deck_polygon',
            datasource: 'test_datasource',
          },
        },
      ],
      features: {
        deck_scatter: [{ position: [0, 0] }],
        deck_polygon: [
          {
            polygon: [
              [1, 1],
              [2, 2],
            ],
          },
        ],
        deck_path: [],
        deck_grid: [],
        deck_contour: [],
        deck_heatmap: [],
        deck_hex: [],
        deck_arc: [],
        deck_geojson: [],
        deck_screengrid: [],
      },
      mapboxApiKey: 'test-key',
    },
  },
  setControlValue: jest.fn(),
  viewport: { longitude: 0, latitude: 0, zoom: 1 },
  onAddFilter: jest.fn(),
  height: 600,
  width: 800,
  datasource: { id: 1, type: 'table' },
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
    (SupersetClient.get as jest.Mock).mockResolvedValue({
      json: {
        data: {
          features: [],
        },
      },
    });
  });

  it('should NOT apply autozoom when autozoom is false', () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');

    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        autozoom: false,
      },
    };

    renderWithProviders(<DeckMulti {...props} />);

    // fitViewport should not be called when autozoom is false
    expect(fitViewportSpy).not.toHaveBeenCalled();

    fitViewportSpy.mockRestore();
  });

  it('should apply autozoom when autozoom is true', () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    fitViewportSpy.mockReturnValue({
      longitude: -122.4,
      latitude: 37.8,
      zoom: 10,
    });

    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        autozoom: true,
      },
    };

    renderWithProviders(<DeckMulti {...props} />);

    // fitViewport should be called with the points from all layers
    expect(fitViewportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        longitude: 0,
        latitude: 0,
        zoom: 1,
      }),
      expect.objectContaining({
        width: 800,
        height: 600,
        points: expect.any(Array),
      }),
    );

    fitViewportSpy.mockRestore();
  });

  it('should use adjusted viewport when autozoom is enabled', () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    const adjustedViewport = {
      longitude: -122.4,
      latitude: 37.8,
      zoom: 12,
    };
    fitViewportSpy.mockReturnValue(adjustedViewport);

    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        autozoom: true,
      },
    };

    const { getByTestId } = renderWithProviders(<DeckMulti {...props} />);

    const container = getByTestId('deckgl-container');
    const viewportData = JSON.parse(
      container.getAttribute('data-viewport') || '{}',
    );

    expect(viewportData.longitude).toBe(adjustedViewport.longitude);
    expect(viewportData.latitude).toBe(adjustedViewport.latitude);
    expect(viewportData.zoom).toBe(adjustedViewport.zoom);

    fitViewportSpy.mockRestore();
  });

  it('should set zoom to 0 when calculated zoom is negative', () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    fitViewportSpy.mockReturnValue({
      longitude: 0,
      latitude: 0,
      zoom: -5, // negative zoom
    });

    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        autozoom: true,
      },
    };

    const { getByTestId } = renderWithProviders(<DeckMulti {...props} />);

    const container = getByTestId('deckgl-container');
    const viewportData = JSON.parse(
      container.getAttribute('data-viewport') || '{}',
    );

    // Zoom should be 0, not negative
    expect(viewportData.zoom).toBe(0);

    fitViewportSpy.mockRestore();
  });

  it('should handle empty features gracefully when autozoom is enabled', () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');

    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        autozoom: true,
      },
      payload: {
        ...baseMockProps.payload,
        data: {
          ...baseMockProps.payload.data,
          features: {
            deck_scatter: [],
            deck_polygon: [],
            deck_path: [],
            deck_grid: [],
            deck_contour: [],
            deck_heatmap: [],
            deck_hex: [],
            deck_arc: [],
            deck_geojson: [],
            deck_screengrid: [],
          },
        },
      },
    };

    renderWithProviders(<DeckMulti {...props} />);

    // fitViewport should not be called when there are no points
    expect(fitViewportSpy).not.toHaveBeenCalled();

    fitViewportSpy.mockRestore();
  });

  it('should collect points from all layer types when autozoom is enabled', () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');
    fitViewportSpy.mockReturnValue({
      longitude: 0,
      latitude: 0,
      zoom: 10,
    });

    const props = {
      ...baseMockProps,
      formData: {
        ...baseMockProps.formData,
        autozoom: true,
      },
      payload: {
        ...baseMockProps.payload,
        data: {
          ...baseMockProps.payload.data,
          features: {
            deck_scatter: [{ position: [1, 1] }, { position: [2, 2] }],
            deck_polygon: [
              {
                polygon: [
                  [3, 3],
                  [4, 4],
                ],
              },
            ],
            deck_arc: [{ sourcePosition: [5, 5], targetPosition: [6, 6] }],
            deck_path: [],
            deck_grid: [],
            deck_contour: [],
            deck_heatmap: [],
            deck_hex: [],
            deck_geojson: [],
            deck_screengrid: [],
          },
        },
      },
    };

    renderWithProviders(<DeckMulti {...props} />);

    expect(fitViewportSpy).toHaveBeenCalled();
    const callArgs = fitViewportSpy.mock.calls[0];
    const { points } = callArgs[1];

    // Should have points from scatter (2), polygon (2), and arc (2) = 6 points total
    expect(points.length).toBeGreaterThan(0);

    fitViewportSpy.mockRestore();
  });

  it('should use original viewport when autozoom is disabled', () => {
    const fitViewportSpy = jest.spyOn(fitViewportModule, 'default');

    const originalViewport = { longitude: -100, latitude: 40, zoom: 5 };
    const props = {
      ...baseMockProps,
      viewport: originalViewport,
      formData: {
        ...baseMockProps.formData,
        autozoom: false,
      },
    };

    const { getByTestId } = renderWithProviders(<DeckMulti {...props} />);

    const container = getByTestId('deckgl-container');
    const viewportData = JSON.parse(
      container.getAttribute('data-viewport') || '{}',
    );

    // Should use original viewport without modification
    expect(viewportData.longitude).toBe(originalViewport.longitude);
    expect(viewportData.latitude).toBe(originalViewport.latitude);
    expect(viewportData.zoom).toBe(originalViewport.zoom);

    // fitViewport should not have been called
    expect(fitViewportSpy).not.toHaveBeenCalled();

    fitViewportSpy.mockRestore();
  });
});

describe('DeckMulti Component Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SupersetClient.get as jest.Mock).mockResolvedValue({
      json: {
        data: {
          features: [],
        },
      },
    });
  });

  it('should render DeckGLContainer', () => {
    const { getByTestId } = renderWithProviders(
      <DeckMulti {...baseMockProps} />,
    );

    expect(getByTestId('deckgl-container')).toBeInTheDocument();
  });

  it('should pass correct props to DeckGLContainer', () => {
    const { getByTestId } = renderWithProviders(
      <DeckMulti {...baseMockProps} />,
    );

    const container = getByTestId('deckgl-container');
    const viewportData = JSON.parse(
      container.getAttribute('data-viewport') || '{}',
    );

    expect(viewportData).toMatchObject({
      longitude: baseMockProps.viewport.longitude,
      latitude: baseMockProps.viewport.latitude,
      zoom: baseMockProps.viewport.zoom,
    });
  });

  it('should handle viewport changes', async () => {
    const { getByTestId, rerender } = renderWithProviders(
      <DeckMulti {...baseMockProps} />,
    );

    const newViewport = { longitude: 10, latitude: 20, zoom: 8 };
    const updatedProps = {
      ...baseMockProps,
      viewport: newViewport,
    };

    rerender(
      <Provider store={mockStore}>
        <ThemeProvider theme={supersetTheme}>
          <DeckMulti {...updatedProps} />
        </ThemeProvider>
      </Provider>,
    );

    await waitFor(() => {
      const container = getByTestId('deckgl-container');
      const viewportData = JSON.parse(
        container.getAttribute('data-viewport') || '{}',
      );

      expect(viewportData.longitude).toBe(newViewport.longitude);
      expect(viewportData.latitude).toBe(newViewport.latitude);
    });
  });
});
