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
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import '@testing-library/jest-dom';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import type { ReactElement } from 'react';
import Legend, { type LegendProps } from './Legend';

const renderWithTheme = (component: ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

test('formats interval-notation labels while preserving brackets', () => {
  renderWithTheme(
    <Legend
      format=",.2f"
      position="tr"
      categories={{
        '[1, 81)': { enabled: true, color: [0, 0, 0] },
        '[81, 212)': { enabled: true, color: [0, 0, 0] },
        '[212, 369]': { enabled: true, color: [0, 0, 0] },
      }}
    />,
  );

  expect(screen.getByText('[1.00, 81.00)')).toBeInTheDocument();
  expect(screen.getByText('[81.00, 212.00)')).toBeInTheDocument();
  expect(screen.getByText('[212.00, 369.00]')).toBeInTheDocument();
});

test('still formats legacy "a - b" delimiter labels', () => {
  renderWithTheme(
    <Legend
      format=",.1f"
      position="tr"
      categories={{
        '0 - 100000': { enabled: true, color: [0, 0, 0] },
        '100001 - 200000': { enabled: true, color: [0, 0, 0] },
      }}
    />,
  );

  expect(screen.getByText('0.0 - 100,000.0')).toBeInTheDocument();
  expect(screen.getByText('100,001.0 - 200,000.0')).toBeInTheDocument();
});

test('leaves labels untouched when no format is provided', () => {
  renderWithTheme(
    <Legend
      format={null}
      position="tr"
      categories={{ '[1, 81)': { enabled: true, color: [0, 0, 0] } }}
    />,
  );

  expect(screen.getByText('[1, 81)')).toBeInTheDocument();
});

test('clicking a legend item toggles the category without triggering anchor navigation', () => {
  // Regression proof for #33576: legend items render as real <button>
  // elements (not href="#" anchors), so a click has no default navigation
  // action to begin with.
  const toggleCategory = jest.fn();
  renderWithTheme(
    <Legend
      format={null}
      position="tr"
      categories={{
        Positive: { enabled: true, color: [0, 255, 0] },
        Negative: { enabled: true, color: [255, 0, 0] },
      }}
      toggleCategory={toggleCategory}
    />,
  );

  const legendItem = screen.getByRole('button', { name: 'Positive' });
  expect(legendItem.tagName).toBe('BUTTON');
  const clickEvent = createEvent.click(legendItem);
  fireEvent(legendItem, clickEvent);

  expect(toggleCategory).toHaveBeenCalledTimes(1);
  expect(toggleCategory).toHaveBeenCalledWith('Positive');
});

test('normalizes the 0-255 deck.gl alpha channel to the 0-1 range CSS rgba() expects', () => {
  renderWithTheme(
    <Legend
      format={null}
      categories={{
        Translucent: { enabled: true, color: [255, 0, 0, 128] },
      }}
    />,
  );

  const legendItem = screen.getByRole('button', { name: 'Translucent' });
  const swatch = legendItem.firstChild as HTMLElement;
  expect(swatch).toHaveStyle(`background-color: rgba(255, 0, 0, ${128 / 255})`);
});

test('ctrl+clicking a legend item toggles the category without opening a new tab', () => {
  // Regression proof for #34157: legend items render as real <button>
  // elements (not href="#" anchors), so a ctrl+click has no "open link in
  // new tab" behavior to begin with.
  const toggleCategory = jest.fn();
  renderWithTheme(
    <Legend
      format={null}
      position="tr"
      categories={{
        cat1: { enabled: true, color: [255, 0, 0] },
        cat2: { enabled: false, color: [0, 0, 255] },
      }}
      toggleCategory={toggleCategory}
    />,
  );

  const legendItem = screen.getByRole('button', { name: 'cat1' });
  expect(legendItem.tagName).toBe('BUTTON');
  const ctrlClickEvent = createEvent.click(legendItem, {
    ctrlKey: true,
  }) as MouseEvent;
  fireEvent(legendItem, ctrlClickEvent);

  expect(ctrlClickEvent.ctrlKey).toBe(true);
  expect(toggleCategory).toHaveBeenCalledTimes(1);
  expect(toggleCategory).toHaveBeenCalledWith('cat1');
});

// Regression proof for the "Legend Position: None" control not hiding the
// legend. "None" is the 'none' sentinel; null and '' also hide so charts saved
// under the older null-valued choice keep working.
test.each(['none', null, ''])(
  'renders nothing when Legend Position is None (position=%p)',
  position => {
    renderWithTheme(
      <Legend
        format={null}
        position={position as LegendProps['position']}
        categories={{ Alpha: { enabled: true, color: [0, 0, 0] } }}
      />,
    );

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  },
);

test('renders the legend for a valid corner position', () => {
  renderWithTheme(
    <Legend
      format={null}
      position="tr"
      categories={{ Alpha: { enabled: true, color: [0, 0, 0] } }}
    />,
  );

  expect(screen.getByText('Alpha')).toBeInTheDocument();
});

test('falls back to the top-right default when position is unset', () => {
  // Layers without a Legend Position control (e.g. Hex, Path) pass an
  // undefined position; the legend must still render at the default corner.
  renderWithTheme(
    <Legend
      format={null}
      position={undefined}
      categories={{ Alpha: { enabled: true, color: [0, 0, 0] } }}
    />,
  );

  expect(screen.getByText('Alpha')).toBeInTheDocument();
});
