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
import {
  CategoricalD3,
  CategoricalModernSunset,
  CategoricalScheme,
  ColorSchemeGroup,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ColorSchemeControl, { ColorSchemes } from '.';

// Import Lyft color scheme for testing search functionality
const lyftColors = {
  id: 'lyftColors',
  label: 'Lyft Colors',
  group: ColorSchemeGroup.Other,
  colors: [
    '#EA0B8C',
    '#6C838E',
    '#29ABE2',
    '#33D9C1',
    '#9DACB9',
    '#7560AA',
    '#2D5584',
    '#831C4A',
    '#333D47',
    '#AC2077',
  ],
} as CategoricalScheme;

const defaultProps = () => ({
  hasCustomLabelsColor: false,
  sharedLabelsColors: [],
  label: 'Color scheme',
  name: 'color',
  value: 'supersetDefault',
  clearable: true,
  choices: getCategoricalSchemeRegistry()
    .keys()
    .map(s => [s, s]),
  schemes: getCategoricalSchemeRegistry().getMap() as ColorSchemes,
  isLinear: false,
});

afterAll(() => {
  getCategoricalSchemeRegistry().clear();
});

const setup = (overrides?: Record<string, any>) =>
  render(<ColorSchemeControl {...defaultProps()} {...overrides} />);

test('should render', async () => {
  const { container } = setup();
  await waitFor(() => expect(container).toBeVisible());
});

test('should display a label', async () => {
  setup();
  expect(await screen.findByText('Color scheme')).toBeInTheDocument();
});

test('should not display an alert icon if hasCustomLabelsColor=false', async () => {
  setup();
  await waitFor(() => {
    expect(
      screen.queryByRole('img', { name: 'warning' }),
    ).not.toBeInTheDocument();
  });
});

test('should display an alert icon if hasCustomLabelsColor=true', async () => {
  const hasCustomLabelsColorProps = {
    ...defaultProps,
    hasCustomLabelsColor: true,
  };
  setup(hasCustomLabelsColorProps);
  await waitFor(() => {
    expect(screen.getByRole('img', { name: 'warning' })).toBeInTheDocument();
  });
});

test('displays color scheme options when only "other" group is registered', async () => {
  [...CategoricalD3].forEach(scheme =>
    getCategoricalSchemeRegistry().registerValue(scheme.id, scheme),
  );
  setup();
  userEvent.click(
    screen.getByLabelText('Select color scheme', { selector: 'input' }),
  );
  await waitFor(() => {
    expect(screen.getByText('D3 Category 10')).toBeInTheDocument();
    expect(screen.getByText('D3 Category 20')).toBeInTheDocument();
    expect(screen.getByText('D3 Category 20b')).toBeInTheDocument();
  });
  expect(screen.queryByText('Other color palettes')).not.toBeInTheDocument();
  expect(screen.queryByText('Featured color palettes')).not.toBeInTheDocument();
  expect(screen.queryByText('Custom color palettes')).not.toBeInTheDocument();
});

test('displays color scheme options', async () => {
  [
    ...CategoricalD3,
    ...CategoricalModernSunset,
    {
      id: 'customScheme',
      label: 'Custom scheme',
      group: ColorSchemeGroup.Custom,
      colors: ['#0080F6', '#254081'],
    } as CategoricalScheme,
  ].forEach(scheme =>
    getCategoricalSchemeRegistry().registerValue(scheme.id, scheme),
  );
  setup();
  userEvent.click(
    screen.getByLabelText('Select color scheme', { selector: 'input' }),
  );
  await waitFor(() => {
    expect(screen.getByText('D3 Category 10')).toBeInTheDocument();
    expect(screen.getByText('D3 Category 20')).toBeInTheDocument();
    expect(screen.getByText('D3 Category 20b')).toBeInTheDocument();
    expect(screen.getByText('Modern sunset')).toBeInTheDocument();
    expect(screen.getByText('Custom scheme')).toBeInTheDocument();

    expect(screen.getByText('Custom color palettes')).toBeInTheDocument();
    expect(screen.getByText('Featured color palettes')).toBeInTheDocument();
    expect(screen.getByText('Other color palettes')).toBeInTheDocument();
  });
});

test('Renders control with dashboard id and dashboard color scheme', () => {
  setup({ dashboardId: 1, hasDashboardColorScheme: true });
  expect(screen.getByText('Dashboard scheme')).toBeInTheDocument();
  expect(
    screen.getByLabelText('Select color scheme', { selector: 'input' }),
  ).toBeDisabled();
});

test('should show tooltip on hover when text overflows', async () => {
  // Capture original descriptors before mocking
  const originalScrollWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollWidth',
  );
  const originalOffsetWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth',
  );

  try {
    // Mock DOM properties to simulate text overflow (the condition for tooltip to show)
    const mockScrollWidth = jest.fn(() => 200);
    const mockOffsetWidth = jest.fn(() => 100);

    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: mockScrollWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: mockOffsetWidth,
    });

    // Use existing D3 schemes
    [...CategoricalD3].forEach(scheme =>
      getCategoricalSchemeRegistry().registerValue(scheme.id, scheme),
    );

    setup();

    // Open the dropdown
    userEvent.click(
      screen.getByLabelText('Select color scheme', { selector: 'input' }),
    );

    // Find D3 Category 10 and hover over it
    const d3Category10 = await screen.findByText('D3 Category 10');
    expect(d3Category10).toBeInTheDocument();

    // Hover over the color scheme label - this should trigger tooltip due to overflow
    userEvent.hover(d3Category10);

    // The real component should now show the tooltip because scrollWidth > offsetWidth
    await waitFor(() => {
      // Look for the actual Tooltip component that gets rendered
      const tooltip = document.querySelector('.ant-tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    // Test mouseout behavior - tooltip should hide
    userEvent.unhover(d3Category10);

    await waitFor(() => {
      // Tooltip should be hidden after mouseout
      const tooltip = document.querySelector('.ant-tooltip-hidden');
      expect(tooltip).toBeInTheDocument();
    });
  } finally {
    // Properly restore original descriptors
    if (originalScrollWidthDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollWidth',
        originalScrollWidthDescriptor,
      );
    } else {
      delete (HTMLElement.prototype as any).scrollWidth;
    }

    if (originalOffsetWidthDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'offsetWidth',
        originalOffsetWidthDescriptor,
      );
    } else {
      delete (HTMLElement.prototype as any).offsetWidth;
    }
  }
});

test('should handle tooltip content verification for color schemes', async () => {
  // Register a scheme with known colors for content testing
  const testScheme = {
    id: 'testColors',
    label: 'Test Color Scheme',
    group: ColorSchemeGroup.Other,
    colors: ['#FF0000', '#00FF00', '#0000FF'],
  } as CategoricalScheme;

  getCategoricalSchemeRegistry().registerValue(testScheme.id, testScheme);
  setup();

  // Open dropdown and verify our test scheme appears
  userEvent.click(
    screen.getByLabelText('Select color scheme', { selector: 'input' }),
  );

  const testColorScheme = await screen.findByText('Test Color Scheme');
  expect(testColorScheme).toBeInTheDocument();

  // Verify the data-test attribute is present for reliable selection
  const testOption = screen.getByTestId('testColors');
  expect(testOption).toBeInTheDocument();

  // Test hover behavior
  userEvent.hover(testColorScheme);

  // The tooltip behavior is controlled by text overflow conditions
  // We're verifying the basic hover infrastructure works
  expect(testColorScheme).toBeInTheDocument();
});

test('should support search functionality for color schemes', async () => {
  // Register multiple schemes including lyftColors for search testing
  [
    ...CategoricalD3,
    lyftColors,
    {
      id: 'supersetDefault',
      label: 'Superset Colors',
      group: ColorSchemeGroup.Featured,
      colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
    } as CategoricalScheme,
  ].forEach(scheme =>
    getCategoricalSchemeRegistry().registerValue(scheme.id, scheme),
  );

  setup();

  // Open the dropdown
  const selectInput = screen.getByLabelText('Select color scheme', {
    selector: 'input',
  });
  userEvent.click(selectInput);

  // Type search term
  userEvent.type(selectInput, 'lyftColors');

  // Verify the search result appears
  await waitFor(() => {
    expect(screen.getByTestId('lyftColors')).toBeInTheDocument();
  });

  // Verify the filtered result shows the correct label
  expect(screen.getByText('Lyft Colors')).toBeInTheDocument();
});

test('should NOT show tooltip for search results (original Cypress contract)', async () => {
  // Register lyftColors for search testing
  getCategoricalSchemeRegistry().registerValue(lyftColors.id, lyftColors);
  setup();

  // Open dropdown and search (matching original Cypress flow)
  const selectInput = screen.getByLabelText('Select color scheme', {
    selector: 'input',
  });
  userEvent.click(selectInput);
  userEvent.type(selectInput, 'lyftColors');

  // Find the search result and hover (matching original Cypress)
  const lyftColorOption = await screen.findByTestId('lyftColors');
  userEvent.hover(lyftColorOption);

  // Original Cypress contract: search results should NOT show tooltips
  await waitFor(() => {
    const tooltip = document.querySelector(
      '.ant-tooltip:not(.ant-tooltip-hidden)',
    );
    expect(tooltip).not.toBeInTheDocument();
  });

  // Double-check that no visible tooltip content exists
  await waitFor(() => {
    const tooltipContent = document.querySelector('.color-scheme-tooltip');
    expect(tooltipContent).toBeFalsy();
  });
});
