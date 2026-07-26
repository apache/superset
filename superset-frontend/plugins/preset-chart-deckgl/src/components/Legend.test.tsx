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
import Legend from './Legend';

const renderWithTheme = (component: ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

test('formats interval-notation labels while preserving brackets', () => {
  renderWithTheme(
    <Legend
      format=",.2f"
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
      categories={{ '[1, 81)': { enabled: true, color: [0, 0, 0] } }}
    />,
  );

  expect(screen.getByText('[1, 81)')).toBeInTheDocument();
});

test('clicking a legend item toggles the category without triggering anchor navigation', () => {
  // Regression proof for #33576: the legend items are href="#" anchors, so a
  // click whose default action is not prevented would navigate to "#" and
  // scroll the browser window to the top of the page.
  const toggleCategory = jest.fn();
  renderWithTheme(
    <Legend
      format={null}
      categories={{
        Positive: { enabled: true, color: [0, 255, 0] },
        Negative: { enabled: true, color: [255, 0, 0] },
      }}
      toggleCategory={toggleCategory}
    />,
  );

  const legendItem = screen.getByRole('button', { name: 'Positive' });
  const clickEvent = createEvent.click(legendItem);
  fireEvent(legendItem, clickEvent);

  expect(clickEvent.defaultPrevented).toBe(true);
  expect(toggleCategory).toHaveBeenCalledTimes(1);
  expect(toggleCategory).toHaveBeenCalledWith('Positive');
});

test('ctrl+clicking a legend item toggles the category without opening a new tab', () => {
  // Regression proof for #34157: legend items are href="#" anchors, so a
  // ctrl+click whose default action is not prevented would ask the browser
  // to open the "#" href in a new tab instead of just toggling the layer.
  const toggleCategory = jest.fn();
  renderWithTheme(
    <Legend
      format={null}
      categories={{
        cat1: { enabled: true, color: [255, 0, 0] },
        cat2: { enabled: false, color: [0, 0, 255] },
      }}
      toggleCategory={toggleCategory}
    />,
  );

  const legendItem = screen.getByRole('button', { name: 'cat1' });
  const ctrlClickEvent = createEvent.click(legendItem, {
    ctrlKey: true,
  }) as MouseEvent;
  fireEvent(legendItem, ctrlClickEvent);

  // preventDefault() in the onClick handler is what stops the browser's
  // native ctrl+click "open link in new tab" behavior on the anchor.
  expect(ctrlClickEvent.defaultPrevented).toBe(true);
  expect(ctrlClickEvent.ctrlKey).toBe(true);
  expect(toggleCategory).toHaveBeenCalledTimes(1);
  expect(toggleCategory).toHaveBeenCalledWith('cat1');
});
