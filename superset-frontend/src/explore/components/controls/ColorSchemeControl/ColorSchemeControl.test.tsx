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
      screen.queryByRole('img', { name: 'alert-solid' }),
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
    expect(
      screen.getByRole('img', { name: 'alert-solid' }),
    ).toBeInTheDocument();
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
