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
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import type { ReactElement } from 'react';
import Tooltip from './Tooltip';

const renderWithTheme = (component: ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

const tooltip = {
  x: 10,
  y: 20,
  content: <span data-test="tooltip-content">Fremont: 42</span>,
};

test('renders an opaque, themed surface for the default variant', () => {
  renderWithTheme(<Tooltip tooltip={tooltip} />);

  const container = screen.getByTestId('tooltip-content').parentElement;
  expect(container).toHaveStyle({
    background: supersetTheme.colorBgElevated,
    color: supersetTheme.colorText,
  });
});

test('renders an opaque, themed surface for the custom (handlebars) variant, see #41154', () => {
  renderWithTheme(<Tooltip tooltip={tooltip} variant="custom" />);

  // Custom tooltip content comes from a user-supplied handlebars template, so
  // the container must supply its own background instead of letting the map
  // show through. See https://github.com/apache/superset/issues/41154
  const container = screen.getByTestId('tooltip-content').parentElement;
  expect(container).toHaveStyle({
    background: supersetTheme.colorBgElevated,
    color: supersetTheme.colorText,
    'border-radius': `${supersetTheme.borderRadius}px`,
    padding: `${supersetTheme.sizeUnit * 2}px`,
  });
});

test('renders nothing without a tooltip', () => {
  const { container } = renderWithTheme(<Tooltip tooltip={null} />);
  expect(container).toBeEmptyDOMElement();
});
