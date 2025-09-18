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
// eslint-disable-next-line import/no-extraneous-dependencies
import { render, screen } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import '@testing-library/jest-dom';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import DeckGLPolygon, { getPoints } from './Polygon';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import * as utils from '../../utils';

// Mock the utils functions
const mockGetBuckets = jest.spyOn(utils, 'getBuckets');
const mockGetColorBreakpointsBuckets = jest.spyOn(
  utils,
  'getColorBreakpointsBuckets',
);

// Mock DeckGL container and Legend
jest.mock('../../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: ({ children }: any) => (
    <div data-testid="deckgl-container">{children}</div>
  ),
}));

jest.mock('../../components/Legend', () => ({ categories, position }: any) => (
  <div
    data-testid="legend"
    data-categories={JSON.stringify(categories)}
    data-position={position}
  >
    Legend Mock
  </div>
));

const mockProps = {
  formData: {
    // Required QueryFormData properties
    datasource: 'test_datasource',
    viz_type: 'deck_polygon',
    // Polygon-specific properties
    metric: { label: 'population' },
    color_scheme_type: COLOR_SCHEME_TYPES.linear_palette,
    legend_position: 'tr',
    legend_format: '.2f',
    autozoom: false,
    mapbox_style: 'mapbox://styles/mapbox/light-v9',
    opacity: 80,
    filled: true,
    stroked: true,
    extruded: false,
    line_width: 1,
    line_width_unit: 'pixels',
    multiplier: 1,
    break_points: [],
    num_buckets: '5',
    linear_color_scheme: 'blue_white_yellow',
  },
  payload: {
    data: {
      features: [
        {
          population: 100000,
          polygon: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        },
        {
          population: 200000,
          polygon: [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 3],
          ],
        },
      ],
      mapboxApiKey: 'test-key',
    },
    form_data: {},
  },
  setControlValue: jest.fn(),
  viewport: { longitude: 0, latitude: 0, zoom: 1 },
  onAddFilter: jest.fn(),
  width: 800,
  height: 600,
  onContextMenu: jest.fn(),
  setDataMask: jest.fn(),
  filterState: undefined,
  emitCrossFilters: false,
};

describe('DeckGLPolygon bucket generation logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBuckets.mockReturnValue({
      '100000 - 150000': { color: [0, 100, 200], enabled: true },
      '150000 - 200000': { color: [50, 150, 250], enabled: true },
    });
    mockGetColorBreakpointsBuckets.mockReturnValue({});
  });

  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

  test('should use getBuckets for linear_palette color scheme', () => {
    const propsWithLinearPalette = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        color_scheme_type: COLOR_SCHEME_TYPES.linear_palette,
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithLinearPalette} />);

    // Should call getBuckets, not getColorBreakpointsBuckets
    expect(mockGetBuckets).toHaveBeenCalled();
    expect(mockGetColorBreakpointsBuckets).not.toHaveBeenCalled();
  });

  test('should use getBuckets for fixed_color color scheme', () => {
    const propsWithFixedColor = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithFixedColor} />);

    // Should call getBuckets, not getColorBreakpointsBuckets
    expect(mockGetBuckets).toHaveBeenCalled();
    expect(mockGetColorBreakpointsBuckets).not.toHaveBeenCalled();
  });

  test('should use getColorBreakpointsBuckets for color_breakpoints scheme', () => {
    const propsWithBreakpoints = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        color_scheme_type: COLOR_SCHEME_TYPES.color_breakpoints,
        color_breakpoints: [
          {
            minValue: 0,
            maxValue: 100000,
            color: { r: 255, g: 0, b: 0, a: 100 },
          },
          {
            minValue: 100001,
            maxValue: 200000,
            color: { r: 0, g: 255, b: 0, a: 100 },
          },
        ],
      },
    };

    mockGetColorBreakpointsBuckets.mockReturnValue({
      '0 - 100000': { color: [255, 0, 0], enabled: true },
      '100001 - 200000': { color: [0, 255, 0], enabled: true },
    });

    renderWithTheme(<DeckGLPolygon {...propsWithBreakpoints} />);

    // Should call getColorBreakpointsBuckets, not getBuckets
    expect(mockGetColorBreakpointsBuckets).toHaveBeenCalled();
    expect(mockGetBuckets).not.toHaveBeenCalled();
  });

  test('should use getBuckets when color_scheme_type is undefined (backward compatibility)', () => {
    const propsWithUndefinedScheme = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        color_scheme_type: undefined,
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithUndefinedScheme} />);

    // Should call getBuckets for backward compatibility
    expect(mockGetBuckets).toHaveBeenCalled();
    expect(mockGetColorBreakpointsBuckets).not.toHaveBeenCalled();
  });

  test('should use getBuckets for unsupported color schemes (categorical_palette)', () => {
    const propsWithUnsupportedScheme = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithUnsupportedScheme} />);

    // Should fall back to getBuckets for unsupported color schemes
    expect(mockGetBuckets).toHaveBeenCalled();
    expect(mockGetColorBreakpointsBuckets).not.toHaveBeenCalled();
  });
});

describe('DeckGLPolygon Error Handling and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBuckets.mockReturnValue({});
    mockGetColorBreakpointsBuckets.mockReturnValue({});
  });

  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

  test('handles empty features data gracefully', () => {
    const propsWithEmptyData = {
      ...mockProps,
      payload: {
        ...mockProps.payload,
        data: {
          ...mockProps.payload.data,
          features: [],
        },
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithEmptyData} />);

    // Should still call getBuckets with empty data
    expect(mockGetBuckets).toHaveBeenCalled();
    expect(mockGetColorBreakpointsBuckets).not.toHaveBeenCalled();
  });

  test('handles missing color_breakpoints for color_breakpoints scheme', () => {
    const propsWithMissingBreakpoints = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        color_scheme_type: COLOR_SCHEME_TYPES.color_breakpoints,
        color_breakpoints: undefined,
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithMissingBreakpoints} />);

    // Should call getColorBreakpointsBuckets even with undefined breakpoints
    expect(mockGetColorBreakpointsBuckets).toHaveBeenCalledWith(undefined);
    expect(mockGetBuckets).not.toHaveBeenCalled();
  });

  test('handles null legend_position correctly', () => {
    const propsWithNullLegendPosition = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        legend_position: null,
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithNullLegendPosition} />);

    // Legend should not be rendered when position is null
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });
});

describe('DeckGLPolygon Legend Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBuckets.mockReturnValue({
      '100000 - 150000': { color: [0, 100, 200], enabled: true },
      '150000 - 200000': { color: [50, 150, 250], enabled: true },
    });
  });

  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

  test('renders legend with non-empty categories when metric and linear_palette are defined', () => {
    const { container } = renderWithTheme(<DeckGLPolygon {...mockProps} />);

    // Verify the component renders and calls the correct bucket function
    expect(mockGetBuckets).toHaveBeenCalled();
    expect(mockGetColorBreakpointsBuckets).not.toHaveBeenCalled();

    // Verify the legend mock was rendered with non-empty categories
    const legendElement = container.querySelector('[data-testid="legend"]');
    expect(legendElement).toBeTruthy();
    const categoriesAttr = legendElement?.getAttribute('data-categories');
    const categoriesData = JSON.parse(categoriesAttr || '{}');
    expect(Object.keys(categoriesData)).toHaveLength(2);
  });

  test('does not render legend when metric is null', () => {
    const propsWithoutMetric = {
      ...mockProps,
      formData: {
        ...mockProps.formData,
        metric: null,
      },
    };

    renderWithTheme(<DeckGLPolygon {...propsWithoutMetric} />);

    // Legend should not be rendered when no metric is defined
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });
});

describe('getPoints utility', () => {
  test('extracts points from polygon data', () => {
    const data = [
      {
        polygon: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      },
      {
        polygon: [
          [2, 2],
          [3, 2],
          [3, 3],
          [2, 3],
        ],
      },
    ];

    const points = getPoints(data);

    expect(points).toHaveLength(8); // 4 points per polygon * 2 polygons
    expect(points[0]).toEqual([0, 0]);
    expect(points[4]).toEqual([2, 2]);
  });
});
