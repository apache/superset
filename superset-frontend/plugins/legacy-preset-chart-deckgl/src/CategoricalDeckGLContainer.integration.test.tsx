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
jest.mock('./DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: jest.forwardRef((props: any, ref: any) => (
    <div data-testid="deck-gl-container" {...props} ref={ref} />
  )),
}));

jest.mock('./utils/colors', () => ({
  hexToRGB: jest.fn(() => [255, 0, 0, 255]),
}));

jest.mock('./utils/sandbox', () => jest.fn(code => eval(code)));
jest.mock('./utils/fitViewport', () => jest.fn(viewport => viewport));

// Mock Legend component with simplified rendering logic
jest.mock('./components/Legend', () => {
  return jest.fn(({ categories = {}, position }) => {
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
  });
});

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

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={supersetTheme}>
      {component}
    </ThemeProvider>,
  );
};

describe('CategoricalDeckGLContainer Integration Tests', () => {
  describe('Legend Integration', () => {
    test('should render legend when configured correctly with categorical_palette', () => {
      const propsWithCategorical = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
      };

      renderWithTheme(<CategoricalDeckGLContainer {...propsWithCategorical} />);

      const legend = screen.getByTestId('legend');
      expect(legend).toBeInTheDocument();
      expect(screen.getByText('Category A')).toBeInTheDocument();
      expect(screen.getByText('Category B')).toBeInTheDocument();
    });

    test('should not render legend with fixed_color', () => {
      const propsWithFixed = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
        },
      };

      renderWithTheme(<CategoricalDeckGLContainer {...propsWithFixed} />);

      expect(screen.getByTestId('deck-gl-container')).toBeInTheDocument();
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });

    test('should render legend for undefined color_scheme_type', () => {
      const propsWithUndefined = {
        ...defaultProps,
        formData: {
          ...mockFormData,
        },
      };

      renderWithTheme(<CategoricalDeckGLContainer {...propsWithUndefined} />);

      const legend = screen.getByTestId('legend');
      expect(legend).toBeInTheDocument();
      expect(screen.getByText('Category A')).toBeInTheDocument();
      expect(screen.getByText('Category B')).toBeInTheDocument();
    });

    test('should not render legend when legend_position is null', () => {
      const propsWithNoPosition = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
          legend_position: null,
        },
      };

      renderWithTheme(<CategoricalDeckGLContainer {...propsWithNoPosition} />);

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });

    test('should not render legend when no dimension is set', () => {
      const propsWithNoDimension = {
        ...defaultProps,
        formData: {
          ...mockFormData,
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
          dimension: undefined,
        },
      };

      renderWithTheme(<CategoricalDeckGLContainer {...propsWithNoDimension} />);

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });
  });

  describe('Data Integration Tests', () => {
    test('should handle empty data gracefully', () => {
      const propsWithEmptyData = {
        ...defaultProps,
        payload: {
          ...mockPayload,
          data: { features: [] },
        },
        formData: {
          ...mockFormData,
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
      };

      renderWithTheme(<CategoricalDeckGLContainer {...propsWithEmptyData} />);

      expect(screen.getByTestId('deck-gl-container')).toBeInTheDocument();
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });

    test('should handle data updates correctly', () => {
      const { rerender } = renderWithTheme(
        <CategoricalDeckGLContainer {...defaultProps} />,
      );

      const updatedPayload = {
        ...mockPayload,
        data: {
          features: [
            ...mockPayload.data.features,
            {
              cat_color: 'Category C',
              metric: 300,
              source_latitude: 37.7749,
              source_longitude: -122.4194,
              target_latitude: 47.6062,
              target_longitude: -122.3321,
            },
          ],
        },
      };

      const propsWithNewData = {
        ...defaultProps,
        payload: updatedPayload,
        formData: {
          ...mockFormData,
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        },
      };

      rerender(
        <ThemeProvider theme={supersetTheme}>
          <CategoricalDeckGLContainer {...propsWithNewData} />
        </ThemeProvider>,
      );

      expect(screen.getByText('Category A')).toBeInTheDocument();
      expect(screen.getByText('Category B')).toBeInTheDocument();
      expect(screen.getByText('Category C')).toBeInTheDocument();
    });
  });
});

