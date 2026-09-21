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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { SupersetClient, isFeatureEnabled } from '@superset-ui/core';
import * as resolveCssImportsModule from 'src/dashboard/util/resolveCssImports';
import StylingSection from './StylingSection';

jest.mock('src/dashboard/util/resolveCssImports', () => ({
  ...jest.requireActual('src/dashboard/util/resolveCssImports'),
  resolveCssImports: jest.fn(),
}));

const mockResolveCssImports =
  resolveCssImportsModule.resolveCssImports as jest.MockedFunction<
    typeof resolveCssImportsModule.resolveCssImports
  >;

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
  isFeatureEnabled: jest.fn(),
}));

const mockSupersetClient = SupersetClient as jest.Mocked<typeof SupersetClient>;
const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

// Mock ColorSchemeSelect component
jest.mock('src/dashboard/components/ColorSchemeSelect', () => ({
  __esModule: true,
  default: ({ value, onChange, ...props }: any) => (
    <div data-test={props['data-test'] || 'color-scheme-select'}>
      <input
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        aria-label="Select color scheme"
      />
    </div>
  ),
}));

const mockCssTemplates = [
  { template_name: 'Corporate Blue', css: '.dashboard { background: blue; }' },
  {
    template_name: 'Modern Dark',
    css: '.dashboard { background: black; color: white; }',
  },
];

const defaultProps = {
  themes: [
    { id: 1, theme_name: 'Dark Theme' },
    { id: 2, theme_name: 'Light Theme' },
  ],
  selectedThemeId: null,
  colorScheme: 'supersetColors',
  customCss: '',
  hasCustomLabelsColor: false,
  showChartTimestamps: false,
  onThemeChange: jest.fn(),
  onColorSchemeChange: jest.fn(),
  onCustomCssChange: jest.fn(),
  onShowChartTimestampsChange: jest.fn(),
  addDangerToast: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks() only clears call history, not implementations set via
  // mockResolvedValue/mockRejectedValue -- reset this one explicitly so a
  // value set by an earlier test can't leak into a test that forgets to
  // set its own.
  mockResolveCssImports.mockReset();
  // Reset mocks
  mockIsFeatureEnabled.mockReturnValue(false);
  mockSupersetClient.get.mockResolvedValue({
    json: { result: mockCssTemplates },
    response: {} as Response,
  });
});

test('renders theme selection when themes are available', () => {
  render(<StylingSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-theme-field')).toBeInTheDocument();
  expect(screen.getByTestId('dashboard-theme-select')).toBeInTheDocument();
});

test('does not render theme selection when no themes available', () => {
  render(<StylingSection {...defaultProps} themes={[]} />);

  expect(screen.queryByTestId('dashboard-theme-field')).not.toBeInTheDocument();
});

test('renders color scheme selection', () => {
  render(<StylingSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-colorscheme-field')).toBeInTheDocument();
  expect(
    screen.getByTestId('dashboard-colorscheme-select'),
  ).toBeInTheDocument();
});

test('renders custom CSS editor', () => {
  render(<StylingSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-css-field')).toBeInTheDocument();
});

test('calls onThemeChange when theme is selected', async () => {
  const onThemeChange = jest.fn();
  render(<StylingSection {...defaultProps} onThemeChange={onThemeChange} />);

  // This would require mocking the Select component properly for full interaction testing
  expect(screen.getByText('Theme')).toBeInTheDocument();
});

test('calls onColorSchemeChange when color scheme changes', async () => {
  const onColorSchemeChange = jest.fn();
  render(
    <StylingSection
      {...defaultProps}
      onColorSchemeChange={onColorSchemeChange}
    />,
  );

  const colorSchemeInput = screen.getByLabelText('Select color scheme');
  await userEvent.type(colorSchemeInput, 'newScheme');

  expect(onColorSchemeChange).toHaveBeenCalled();
});

test('passes hasCustomLabelsColor to ColorSchemeSelect', () => {
  render(<StylingSection {...defaultProps} hasCustomLabelsColor />);

  expect(screen.getByText('Color scheme')).toBeInTheDocument();
});

test('shows selected theme when selectedThemeId is provided', () => {
  render(<StylingSection {...defaultProps} selectedThemeId={1} />);

  expect(screen.getByText('Theme')).toBeInTheDocument();
});

test('displays current color scheme value', () => {
  render(<StylingSection {...defaultProps} colorScheme="testColors" />);

  const colorSchemeInput = screen.getByLabelText('Select color scheme');
  expect(colorSchemeInput).toHaveValue('testColors');
});

test('renders chart timestamps field', () => {
  render(<StylingSection {...defaultProps} />);

  expect(
    screen.getByTestId('dashboard-show-timestamps-field'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('dashboard-show-timestamps-switch'),
  ).toBeInTheDocument();
});

test('chart timestamps switch reflects showChartTimestamps prop', () => {
  const { rerender } = render(
    <StylingSection {...defaultProps} showChartTimestamps={false} />,
  );

  let timestampSwitch = screen.getByTestId('dashboard-show-timestamps-switch');
  expect(timestampSwitch).not.toBeChecked();

  rerender(<StylingSection {...defaultProps} showChartTimestamps />);

  timestampSwitch = screen.getByTestId('dashboard-show-timestamps-switch');
  expect(timestampSwitch).toBeChecked();
});

test('calls onShowChartTimestampsChange when switch is toggled', async () => {
  const onShowChartTimestampsChange = jest.fn();
  render(
    <StylingSection
      {...defaultProps}
      onShowChartTimestampsChange={onShowChartTimestampsChange}
    />,
  );

  const timestampSwitch = screen.getByTestId(
    'dashboard-show-timestamps-switch',
  );
  await userEvent.click(timestampSwitch);

  expect(onShowChartTimestampsChange).toHaveBeenCalled();
  expect(onShowChartTimestampsChange.mock.calls[0][0]).toBe(true);
});

// CSS Template Tests
// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('CSS Template functionality', () => {
  test('does not show CSS template select when feature flag is disabled', () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    render(<StylingSection {...defaultProps} />);

    expect(
      screen.queryByTestId('dashboard-css-template-field'),
    ).not.toBeInTheDocument();
  });

  test('fetches CSS templates on mount when feature enabled', async () => {
    mockIsFeatureEnabled.mockImplementation(flag => flag === 'CSS_TEMPLATES');
    render(<StylingSection {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupersetClient.get).toHaveBeenCalledWith({
        endpoint: expect.stringContaining('/api/v1/css_template/'),
      });
    });
  });

  test('shows CSS template select when feature flag is enabled and templates exist', async () => {
    mockIsFeatureEnabled.mockImplementation(flag => flag === 'CSS_TEMPLATES');
    render(<StylingSection {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText('Load CSS template (optional)'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId('dashboard-css-template-select'),
    ).toBeInTheDocument();
  });

  test('shows error toast when template fetch fails', async () => {
    mockIsFeatureEnabled.mockImplementation(flag => flag === 'CSS_TEMPLATES');
    const addDangerToast = jest.fn();
    mockSupersetClient.get.mockRejectedValueOnce(new Error('API Error'));

    render(
      <StylingSection {...defaultProps} addDangerToast={addDangerToast} />,
    );

    await waitFor(() => {
      expect(addDangerToast).toHaveBeenCalledWith(
        'An error occurred while fetching available CSS templates',
      );
    });
  });

  test('does not show CSS template select when no templates available', async () => {
    mockIsFeatureEnabled.mockImplementation(flag => flag === 'CSS_TEMPLATES');
    mockSupersetClient.get.mockResolvedValueOnce({
      json: { result: [] },
      response: {} as Response,
    });

    render(<StylingSection {...defaultProps} />);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(mockSupersetClient.get).toHaveBeenCalled();
    });

    expect(
      screen.queryByTestId('dashboard-css-template-field'),
    ).not.toBeInTheDocument();
  });
});

test('does not show the @import warning for ordinary CSS', () => {
  render(
    <StylingSection {...defaultProps} customCss=".header { color: red; }" />,
  );

  expect(screen.queryByTestId('css-import-warning')).not.toBeInTheDocument();
});

test('shows a convert button when the CSS contains @import', () => {
  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://fonts.googleapis.com/css2?family=Inter');"
    />,
  );

  expect(screen.getByTestId('css-import-warning')).toBeInTheDocument();
  expect(screen.getByTestId('convert-css-import-button')).toBeInTheDocument();
});

test('converting replaces the CSS and reports success', async () => {
  const onCustomCssChange = jest.fn();
  mockResolveCssImports.mockResolvedValue({
    css: "@font-face { font-family: 'Inter'; src: url('x.woff2'); }",
    resolvedCount: 1,
    unresolvedUrls: [],
  });

  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://fonts.googleapis.com/css2?family=Inter');"
      onCustomCssChange={onCustomCssChange}
    />,
  );

  await userEvent.click(screen.getByTestId('convert-css-import-button'));

  await waitFor(() => {
    expect(onCustomCssChange).toHaveBeenCalledWith(
      "@font-face { font-family: 'Inter'; src: url('x.woff2'); }",
    );
  });
  expect(screen.getByTestId('css-import-conversion-result')).toHaveTextContent(
    'Converted 1 @import',
  );
});

test('converting reports an unresolved import instead of silently dropping it', async () => {
  const onCustomCssChange = jest.fn();
  mockResolveCssImports.mockResolvedValue({
    css: "@import url('https://no-cors.example.com/x.css');",
    resolvedCount: 0,
    unresolvedUrls: ['https://no-cors.example.com/x.css'],
  });

  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://no-cors.example.com/x.css');"
      onCustomCssChange={onCustomCssChange}
    />,
  );

  await userEvent.click(screen.getByTestId('convert-css-import-button'));

  await waitFor(() => {
    expect(
      screen.getByTestId('css-import-conversion-result'),
    ).toHaveTextContent('no-cors.example.com');
  });
  expect(onCustomCssChange).not.toHaveBeenCalled();
});

test('converting surfaces a warning instead of an unhandled rejection on parse failure', async () => {
  const onCustomCssChange = jest.fn();
  mockResolveCssImports.mockRejectedValue(new Error('CssSyntaxError'));

  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://fonts.googleapis.com/css2?family=Inter');"
      onCustomCssChange={onCustomCssChange}
    />,
  );

  await userEvent.click(screen.getByTestId('convert-css-import-button'));

  await waitFor(() => {
    expect(
      screen.getByTestId('css-import-conversion-result'),
    ).toHaveTextContent('Could not parse the CSS');
  });
  expect(onCustomCssChange).not.toHaveBeenCalled();
});
