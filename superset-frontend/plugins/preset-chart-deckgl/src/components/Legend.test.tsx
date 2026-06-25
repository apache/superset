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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import Legend, { LegendProps } from './Legend';
import { NULL_CATEGORY_KEY } from '../utils';

const renderLegend = (props: Partial<LegendProps> = {}) => {
  const defaults: LegendProps = {
    format: null,
    categories: {},
    ...props,
  };
  return render(
    <ThemeProvider theme={supersetTheme}>
      <Legend {...defaults} />
    </ThemeProvider>,
  );
};

test('renders a label for a normal category key', () => {
  renderLegend({
    categories: {
      California: { enabled: true, color: [255, 0, 0, 255] },
    },
  });

  expect(screen.getByText('California')).toBeInTheDocument();
});

test('renders N/A for null category key', () => {
  renderLegend({
    categories: {
      [NULL_CATEGORY_KEY]: { enabled: true, color: [0, 128, 0, 255] },
    },
  });

  expect(screen.getByText('N/A')).toBeInTheDocument();
});

test('renders nothing when categories is empty', () => {
  const { container } = renderLegend({ categories: {} });

  expect(container.firstChild).toBeNull();
});

test('renders nothing when position is null', () => {
  const { container } = renderLegend({
    position: null,
    categories: {
      California: { enabled: true, color: [255, 0, 0, 255] },
    },
  });

  expect(container.firstChild).toBeNull();
});

test('calls toggleCategory when a category link is clicked', async () => {
  const toggleCategory = jest.fn();
  renderLegend({
    toggleCategory,
    categories: {
      California: { enabled: true, color: [255, 0, 0, 255] },
    },
  });

  await userEvent.click(screen.getByRole('button'));

  expect(toggleCategory).toHaveBeenCalledWith('California');
});

test('calls toggleCategory with NULL_CATEGORY_KEY when N/A link is clicked', async () => {
  const toggleCategory = jest.fn();
  renderLegend({
    toggleCategory,
    categories: {
      [NULL_CATEGORY_KEY]: { enabled: true, color: [0, 128, 0, 255] },
    },
  });

  await userEvent.click(screen.getByRole('button'));

  expect(toggleCategory).toHaveBeenCalledWith(NULL_CATEGORY_KEY);
});
