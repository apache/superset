/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { render, screen } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import StylingSection from './StylingSection';

const mockIsFeatureEnabled = jest.fn();
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: (feature: string) => mockIsFeatureEnabled(feature),
}));

jest.mock('src/dashboard/components/ColorSchemeSelect', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="Select color scheme"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

jest.mock('src/core/editors', () => ({
  EditorHost: ({ value, onChange, id }: any) => (
    <textarea id={id} value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

const mockSupersetClient = {
  get: jest.fn(),
};
(SupersetClient.get as jest.Mock) = mockSupersetClient.get;

const defaultProps = {
  themes: [],
  selectedThemeId: null,
  colorScheme: 'supersetColors',
  customCss: '',
  hasCustomLabelsColor: false,
  showChartTimestamps: false,
  jsonMetadata: '{}',
  onJsonMetadataChange: jest.fn(),
  onThemeChange: jest.fn(),
  onColorSchemeChange: jest.fn(),
  onCustomCssChange: jest.fn(),
  onShowChartTimestampsChange: jest.fn(),
  addDangerToast: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsFeatureEnabled.mockReturnValue(false);
  mockSupersetClient.get.mockResolvedValue({
    json: {
      result: [
        { template_name: 'Template 1', css: 'body { color: red; }' },
        { template_name: 'Template 2', css: 'body { color: blue; }' },
      ],
    },
  });
});

test('renders styling section properly', () => {
  render(<StylingSection {...defaultProps} />);
  expect(screen.getByText('Color scheme')).toBeInTheDocument();
  expect(screen.getByText('CSS')).toBeInTheDocument();
  expect(screen.getByText('Show chart query timestamps')).toBeInTheDocument();
});

test('renders themes if themes prop has elements', () => {
  render(
    <StylingSection
      {...defaultProps}
      themes={[{ id: 1, theme_name: 'Dark' }]}
    />,
  );
  expect(screen.getByText('Theme')).toBeInTheDocument();
});