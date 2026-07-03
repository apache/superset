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
