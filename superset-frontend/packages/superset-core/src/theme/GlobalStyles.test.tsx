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
import { render } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { Theme } from './Theme';
import { GlobalStyles } from './GlobalStyles';
import { ThemeAlgorithm } from './types';
import * as themeUtils from './utils/themeUtils';

// Mock emotion's cache to avoid actual DOM operations
jest.mock('@emotion/cache', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('GlobalStyles calls isThemeDark with the current theme to determine color-scheme', () => {
  const isThemeDarkSpy = jest.spyOn(themeUtils, 'isThemeDark');
  const lightTheme = Theme.fromConfig({});

  render(
    <ThemeProvider theme={lightTheme.theme}>
      <GlobalStyles />
    </ThemeProvider>,
  );

  expect(isThemeDarkSpy).toHaveBeenCalledWith(lightTheme.theme);
  expect(isThemeDarkSpy).toHaveReturnedWith(false);
});

test('GlobalStyles detects dark theme via isThemeDark', () => {
  const isThemeDarkSpy = jest.spyOn(themeUtils, 'isThemeDark');
  const darkTheme = Theme.fromConfig({ algorithm: ThemeAlgorithm.DARK });

  render(
    <ThemeProvider theme={darkTheme.theme}>
      <GlobalStyles />
    </ThemeProvider>,
  );

  expect(isThemeDarkSpy).toHaveBeenCalledWith(darkTheme.theme);
  expect(isThemeDarkSpy).toHaveReturnedWith(true);
});

test('GlobalStyles renders without errors for light theme', () => {
  const lightTheme = Theme.fromConfig({});

  expect(() => {
    render(
      <ThemeProvider theme={lightTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
    );
  }).not.toThrow();
});

test('GlobalStyles renders without errors for dark theme', () => {
  const darkTheme = Theme.fromConfig({ algorithm: ThemeAlgorithm.DARK });

  expect(() => {
    render(
      <ThemeProvider theme={darkTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
    );
  }).not.toThrow();
});
