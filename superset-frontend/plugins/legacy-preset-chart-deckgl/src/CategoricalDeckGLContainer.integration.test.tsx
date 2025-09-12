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

/**
 * Integration Tests for CategoricalDeckGLContainer
 *
 * Tests the complete component integration including legend visibility,
 * data processing, and user configuration scenarios for Arc and Scatter charts.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import CategoricalDeckGLContainer, {
  CategoricalDeckGLContainerProps,
} from './CategoricalDeckGLContainer';
import { COLOR_SCHEME_TYPES } from './utilities/utils';

// Mock all deck.gl and mapbox dependencies
jest.mock('@deck.gl/core');
jest.mock('@deck.gl/react');
jest.mock('react-map-gl');
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  CategoricalColorNamespace: {
    getScale: jest.fn(() => jest.fn(() => '#ff0000')),
  },
}));

// Mock the heavy dependencies that cause test issues
jest.mock('./DeckGLContainer', () => {
  const React = require('react');
  return {
    DeckGLContainerStyledWrapper: React.forwardRef((props: any, ref: any) =>
      React.createElement('div', {
        'data-testid': 'deck-gl-container',
        ...props,
        ref,
      }),
    ),
  };
});

jest.mock('./utils/colors', () => ({
  hexToRGB: jest.fn(() => [255, 0, 0, 255]),
}));

jest.mock('./utils/sandbox', () => jest.fn(code => eval(code)));
jest.mock('./utils/fitViewport', () => jest.fn(viewport => viewport));

// Mock Legend component with simplified rendering logic
jest.mock('./components/Legend', () =>
  jest.fn(({ categories = {}, position }) => {
    if (Object.keys(categories).length === 0 || position === null) {
      return null;
    }

    return (
      <div data-testid="legend">
        {Object.keys(categories).map(category => (
          <div key={category} data-testid={`legend-item-${category}`}>
            {category}
          </div>
        ))}
      </div>
    );
  }),
);

const mockDatasource = {
  id: 1,
  column_names: ['cat_color', 'metric'],
  verbose_map: {},
  main_dttm_col: null,
  datasource_name: 'test_table',
  description: null,
};

const mockFormData = {
  slice_id: 'test-123',
  viz_type: 'deck_arc',
  datasource: '1__table',
  dimension: 'cat_color',
  legend_position: 'tr',
  color_scheme: 'supersetColors',
};

const mockPayload = {
  form_data: mockFormData,
  data: {
    features: [
      {
        cat_color: 'Category A',
        metric: 100,
        source_latitude: 40.7128,
        source_longitude: -74.006,
        target_latitude: 34.0522,
        target_longitude: -118.2437,
      },
      {
        cat_color: 'Category B',
        metric: 200,
        source_latitude: 41.8781,
        source_longitude: -87.6298,
        target_latitude: 29.7604,
        target_longitude: -95.3698,
      },
    ],
  },
};

const defaultProps: CategoricalDeckGLContainerProps = {
  datasource: mockDatasource,
  formData: mockFormData,
  mapboxApiKey: 'test-key',
  getPoints: jest.fn(() => []),
  height: 400,
  width: 600,
  viewport: { latitude: 0, longitude: 0, zoom: 1 },
  getLayer: jest.fn(() => ({})),
  payload: mockPayload,
  setControlValue: jest.fn(),
  filterState: {},
  setDataMask: jest.fn(),
  onContextMenu: jest.fn(),
  emitCrossFilters: false,
};

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

describe('CategoricalDeckGLContainer Legend Tests', () => {
  describe('Legend Visibility', () => {
    test('should show legend when dimension is set and position is not null', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          dimension: 'cat_color',
          legend_position: 'tr',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
      };

      const { container } = renderWithTheme(
        <CategoricalDeckGLContainer {...props} />,
      );

      // Check for legend using DOM query since getByTestId has issues in this test environment
      const legend = container.querySelector('[data-testid="legend"]');
      expect(legend).toBeInTheDocument();
    });

    test('should show legend even with fixed_color when dimension is set', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          dimension: 'cat_color',
          legend_position: 'bl',
          color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
        },
      };

      const { container } = renderWithTheme(
        <CategoricalDeckGLContainer {...props} />,
      );

      const legend = container.querySelector('[data-testid="legend"]');
      expect(legend).toBeInTheDocument();
    });

    test('should show legend for undefined color_scheme_type (backward compatibility)', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          dimension: 'cat_color',
          legend_position: 'tl',
          // color_scheme_type: undefined
        },
      };

      const { container } = renderWithTheme(
        <CategoricalDeckGLContainer {...props} />,
      );

      const legend = container.querySelector('[data-testid="legend"]');
      expect(legend).toBeInTheDocument();
    });

    test('should NOT show legend when legend_position is null', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          dimension: 'cat_color',
          legend_position: null,
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
      };

      const { container } = renderWithTheme(
        <CategoricalDeckGLContainer {...props} />,
      );

      const legend = container.querySelector('[data-testid="legend"]');
      expect(legend).not.toBeInTheDocument();
    });

    test('should show legend even when dimension is not explicitly set but data has categories', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          dimension: undefined,
          legend_position: 'tr',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
      };

      const { container } = renderWithTheme(
        <CategoricalDeckGLContainer {...props} />,
      );

      // With our fixes, legend shows when there's categorical data available
      const legend = container.querySelector('[data-testid="legend"]');
      expect(legend).toBeInTheDocument();
    });

    test('should NOT show legend when data is empty', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          dimension: 'cat_color',
          legend_position: 'tr',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
        payload: {
          ...mockPayload,
          data: { features: [] },
        },
      };

      const { container } = renderWithTheme(
        <CategoricalDeckGLContainer {...props} />,
      );

      const legend = container.querySelector('[data-testid="legend"]');
      expect(legend).not.toBeInTheDocument();
    });
  });

  describe('Legend Positioning', () => {
    const positions = [
      { position: 'tl', description: 'top-left' },
      { position: 'tr', description: 'top-right' },
      { position: 'bl', description: 'bottom-left' },
      { position: 'br', description: 'bottom-right' },
    ];

    positions.forEach(({ position, description }) => {
      test(`should render legend in ${description} when position is ${position}`, () => {
        const props = {
          ...defaultProps,
          formData: {
            ...mockFormData,
            dimension: 'cat_color',
            legend_position: position,
            color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
          },
        };

        const { container } = renderWithTheme(
          <CategoricalDeckGLContainer {...props} />,
        );

        const legend = container.querySelector('[data-testid="legend"]');
        expect(legend).toBeInTheDocument();

        // The Legend component receives the position prop correctly
        // We can't easily test CSS positioning in JSDOM, but we can verify
        // the legend renders when position is set
      });
    });
  });

  describe('Legend Content', () => {
    test('should show category labels in legend', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          dimension: 'cat_color',
          legend_position: 'tr',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
      };

      const { container } = renderWithTheme(
        <CategoricalDeckGLContainer {...props} />,
      );

      // Check that category text is present in the DOM
      expect(container).toHaveTextContent(/Category A/);
      expect(container).toHaveTextContent(/Category B/);
    });
  });
});
