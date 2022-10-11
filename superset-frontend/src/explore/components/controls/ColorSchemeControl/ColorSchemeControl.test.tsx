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
import React from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import ColorSchemeControl, { ColorSchemes } from '.';

const defaultProps = {
  hasCustomLabelColors: false,
  label: 'Color scheme',
  labelMargin: 0,
  name: 'color',
  value: 'supersetDefault',
  clearable: true,
  choices: [],
  schemes: () => ({} as ColorSchemes),
  isLinear: false,
};

const setup = (overrides?: Record<string, any>) =>
  render(<ColorSchemeControl {...defaultProps} {...overrides} />);

test('should render', async () => {
  const { container } = setup();
  await waitFor(() => expect(container).toBeVisible());
});

test('should display a label', async () => {
  setup();
  expect(await screen.findByText('Color scheme')).toBeTruthy();
});

test('should not display an alert icon if hasCustomLabelColors=false', async () => {
  setup();
  await waitFor(() => {
    expect(
      screen.queryByRole('img', { name: 'alert-solid' }),
    ).not.toBeInTheDocument();
  });
});

test('should display an alert icon if hasCustomLabelColors=true', async () => {
  const hasCustomLabelColorsProps = {
    ...defaultProps,
    hasCustomLabelColors: true,
  };
  setup(hasCustomLabelColorsProps);
  await waitFor(() => {
    expect(
      screen.getByRole('img', { name: 'alert-solid' }),
    ).toBeInTheDocument();
  });
});
