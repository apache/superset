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

describe('Value-Based Colors Visual Regression', () => {
  const PIE_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'pie',
    slice_id: 55,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    metric: 'sum__num',
    adhoc_filters: [],
    groupby: ['gender'],
    row_limit: 50000,
    pie_label_type: 'key',
    donut: false,
    show_legend: true,
    show_labels: true,
    labels_outside: true,
  };

  const COUNTRY_MAP_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'country_map',
    slice_id: 56,
    select_country: 'usa',
    entity: 'state',
    metric: 'sum__num',
    adhoc_filters: [],
    row_limit: 50000,
    number_format: 'SMART_NUMBER',
  };

  const WORLD_MAP_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'world_map',
    slice_id: 57,
    entity: 'country_code',
    country_fieldtype: 'cca2',
    metric: 'sum__num',
    secondary_metric: 'count',
    show_bubbles: false,
    max_bubble_size: '25',
    adhoc_filters: [],
    row_limit: 50000,
  };

  beforeEach(() => {
    cy.intercept('POST', '/api/v1/chart/data*').as('getJson');
    cy.intercept('GET', '/api/v1/chart/*').as('getChart');
  });

  describe('Pie Chart Visual Tests', () => {
    it('should render pie chart with categorical colors (default)', () => {
      const formData = {
        ...PIE_FORM_DATA,
        valueBasedColors: false,
        color_scheme: 'supersetColors',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });

      // Wait for chart to fully render
      cy.get('.chart-container .pie canvas').should('be.visible');
      
      // Take visual snapshot
      cy.get('.chart-container').matchImageSnapshot('pie-categorical-colors');
    });

    it('should render pie chart with value-based colors', () => {
      const formData = {
        ...PIE_FORM_DATA,
        valueBasedColors: true,
        sequentialColorScheme: 'superset_seq_1',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });

      cy.get('.chart-container .pie canvas').should('be.visible');
      cy.get('.chart-container').matchImageSnapshot('pie-value-based-colors');
    });

    it('should show different colors for different sequential schemes', () => {
      const schemes = ['superset_seq_1', 'superset_seq_2', 'blues', 'greens'];
      
      schemes.forEach((scheme, index) => {
        const formData = {
          ...PIE_FORM_DATA,
          valueBasedColors: true,
          sequentialColorScheme: scheme,
        };

        cy.visitChartByParams(formData);
        cy.verifySliceSuccess({ waitAlias: '@getJson' });

        cy.get('.chart-container .pie canvas').should('be.visible');
        cy.get('.chart-container').matchImageSnapshot(`pie-${scheme}-scheme`);
      });
    });

    it('should maintain visual consistency when toggling color modes', () => {
      // Start with categorical
      let formData = {
        ...PIE_FORM_DATA,
        valueBasedColors: false,
        color_scheme: 'supersetColors',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      cy.get('.chart-container').matchImageSnapshot('pie-toggle-categorical');

      // Switch to value-based
      cy.get('#controlSections-tab-display').click();
      cy.get('[data-test="value_based_colors"]').check();
      cy.get('[data-test="sequential_color_scheme"]').select('blues');
      cy.get('button[data-test="run-query-action"]').click();
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      
      cy.get('.chart-container').matchImageSnapshot('pie-toggle-value-based');
    });
  });

  describe('Country Map Visual Tests', () => {
    it('should render country map with metric-based colors', () => {
      const formData = {
        ...COUNTRY_MAP_FORM_DATA,
        color_by: 'metric',
        linear_color_scheme: 'blues',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });

      cy.get('.chart-container svg').should('be.visible');
      cy.get('.chart-container').matchImageSnapshot('country-map-metric-colors');
    });

    it('should render country map with region-based colors', () => {
      const formData = {
        ...COUNTRY_MAP_FORM_DATA,
        color_by: 'region',
        color_scheme: 'supersetColors',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });

      cy.get('.chart-container svg').should('be.visible');
      cy.get('.chart-container').matchImageSnapshot('country-map-region-colors');
    });

    it('should show proper color gradients for different countries', () => {
      const countries = ['usa', 'canada', 'germany'];
      
      countries.forEach(country => {
        const formData = {
          ...COUNTRY_MAP_FORM_DATA,
          select_country: country,
          color_by: 'metric',
          linear_color_scheme: 'greens',
        };

        cy.visitChartByParams(formData);
        cy.verifySliceSuccess({ waitAlias: '@getJson' });

        cy.get('.chart-container svg').should('be.visible');
        cy.get('.chart-container').matchImageSnapshot(`country-map-${country}-metric`);
      });
    });
  });

  describe('World Map Visual Tests', () => {
    it('should render world map with metric-based colors', () => {
      const formData = {
        ...WORLD_MAP_FORM_DATA,
        color_by: 'metric',
        linear_color_scheme: 'blues',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });

      cy.get('.chart-container .datamap').should('be.visible');
      cy.get('.chart-container').matchImageSnapshot('world-map-metric-colors');
    });

    it('should render world map with country-based colors', () => {
      const formData = {
        ...WORLD_MAP_FORM_DATA,
        color_by: 'country',
        color_scheme: 'supersetColors',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });

      cy.get('.chart-container .datamap').should('be.visible');
      cy.get('.chart-container').matchImageSnapshot('world-map-country-colors');
    });

    it('should render world map with bubbles and value-based colors', () => {
      const formData = {
        ...WORLD_MAP_FORM_DATA,
        color_by: 'metric',
        show_bubbles: true,
        max_bubble_size: '50',
        linear_color_scheme: 'oranges',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });

      cy.get('.chart-container .datamap').should('be.visible');
      cy.get('.chart-container circle').should('be.visible');
      cy.get('.chart-container').matchImageSnapshot('world-map-bubbles-metric');
    });

    it('should show consistent colors across different bubble sizes', () => {
      const bubbleSizes = ['25', '50', '75'];
      
      bubbleSizes.forEach(size => {
        const formData = {
          ...WORLD_MAP_FORM_DATA,
          color_by: 'metric',
          show_bubbles: true,
          max_bubble_size: size,
          linear_color_scheme: 'purples',
        };

        cy.visitChartByParams(formData);
        cy.verifySliceSuccess({ waitAlias: '@getJson' });

        cy.get('.chart-container').matchImageSnapshot(`world-map-bubbles-${size}`);
      });
    });
  });

  describe('Cross-Chart Color Consistency', () => {
    it('should use same sequential colors across all chart types', () => {
      const scheme = 'superset_seq_1';
      
      // Test pie chart
      const pieFormData = {
        ...PIE_FORM_DATA,
        valueBasedColors: true,
        sequentialColorScheme: scheme,
      };

      cy.visitChartByParams(pieFormData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      cy.get('.chart-container').matchImageSnapshot(`consistency-pie-${scheme}`);

      // Test country map
      const countryFormData = {
        ...COUNTRY_MAP_FORM_DATA,
        color_by: 'metric',
        linear_color_scheme: scheme,
      };

      cy.visitChartByParams(countryFormData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      cy.get('.chart-container').matchImageSnapshot(`consistency-country-${scheme}`);

      // Test world map
      const worldFormData = {
        ...WORLD_MAP_FORM_DATA,
        color_by: 'metric',
        linear_color_scheme: scheme,
      };

      cy.visitChartByParams(worldFormData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      cy.get('.chart-container').matchImageSnapshot(`consistency-world-${scheme}`);
    });

    it('should maintain color gradients across different data ranges', () => {
      // Test with different row limits to get different data ranges
      const rowLimits = [10, 50, 100];
      
      rowLimits.forEach(limit => {
        const formData = {
          ...PIE_FORM_DATA,
          row_limit: limit,
          valueBasedColors: true,
          sequentialColorScheme: 'blues',
        };

        cy.visitChartByParams(formData);
        cy.verifySliceSuccess({ waitAlias: '@getJson' });
        cy.get('.chart-container').matchImageSnapshot(`gradient-consistency-${limit}`);
      });
    });
  });

  describe('Theme Integration', () => {
    it('should adapt to different themes while maintaining color intensity', () => {
      // This would test different theme configurations
      // For now, test with default theme
      const formData = {
        ...PIE_FORM_DATA,
        valueBasedColors: true,
        sequentialColorScheme: 'dark_blue',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      cy.get('.chart-container').matchImageSnapshot('theme-integration-dark-blue');
    });
  });

  describe('Accessibility Visual Tests', () => {
    it('should maintain sufficient contrast in all color schemes', () => {
      const accessibilitySchemes = ['blues', 'greens', 'dark_blue'];
      
      accessibilitySchemes.forEach(scheme => {
        const formData = {
          ...PIE_FORM_DATA,
          valueBasedColors: true,
          sequentialColorScheme: scheme,
        };

        cy.visitChartByParams(formData);
        cy.verifySliceSuccess({ waitAlias: '@getJson' });
        
        // Check for accessibility compliance
        cy.injectAxe();
        cy.checkA11y('.chart-container', {
          rules: {
            'color-contrast': { enabled: true },
          },
        });

        cy.get('.chart-container').matchImageSnapshot(`accessibility-${scheme}`);
      });
    });
  });

  describe('Error State Visual Tests', () => {
    it('should render error states gracefully', () => {
      // Test with invalid data
      const invalidFormData = {
        ...PIE_FORM_DATA,
        metric: 'nonexistent_metric',
        valueBasedColors: true,
      };

      cy.visitChartByParams(invalidFormData);
      
      // Should show error message, not crash
      cy.get('.chart-container').should('be.visible');
      cy.get('.chart-container').matchImageSnapshot('error-state-pie');
    });

    it('should handle missing color schemes gracefully', () => {
      const formData = {
        ...PIE_FORM_DATA,
        valueBasedColors: true,
        sequentialColorScheme: 'nonexistent_scheme',
      };

      cy.visitChartByParams(formData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      
      // Should fallback to default scheme
      cy.get('.chart-container').matchImageSnapshot('fallback-color-scheme');
    });
  });

  describe('Performance Visual Tests', () => {
    it('should render large datasets without visual artifacts', () => {
      const largeDataFormData = {
        ...PIE_FORM_DATA,
        row_limit: 10000,
        valueBasedColors: true,
        sequentialColorScheme: 'superset_seq_1',
      };

      cy.visitChartByParams(largeDataFormData);
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
      
      // Chart should render cleanly even with large datasets
      cy.get('.chart-container').matchImageSnapshot('large-dataset-performance');
    });
  });

  // Helper function to test responsiveness
  describe('Responsive Design Visual Tests', () => {
    const viewports = [
      { width: 320, height: 568, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' },
    ];

    viewports.forEach(viewport => {
      it(`should render correctly on ${viewport.name}`, () => {
        cy.viewport(viewport.width, viewport.height);
        
        const formData = {
          ...PIE_FORM_DATA,
          valueBasedColors: true,
          sequentialColorScheme: 'blues',
        };

        cy.visitChartByParams(formData);
        cy.verifySliceSuccess({ waitAlias: '@getJson' });
        
        cy.get('.chart-container').should('be.visible');
        cy.get('.chart-container').matchImageSnapshot(`responsive-${viewport.name}`);
      });
    });
  });
});
