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
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { Theme } from './Theme';
import { GlobalStyles } from './GlobalStyles';
import { ThemeAlgorithm } from './types';
import * as themeUtils from './utils/themeUtils';

/**
 * Read all CSS text injected into the document by Emotion's Global component.
 * Emotion uses insertRule() so cssRules is authoritative; textContent is empty.
 */
function getInjectedCss(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        parts.push(rule.cssText);
      }
    } catch {
      // Cross-origin sheets are inaccessible — skip
    }
  }
  return parts.join('\n');
}

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  unmountComponentAtNode(container);
  container.remove();
  // Remove any style tags injected by Emotion to keep tests isolated
  document.querySelectorAll('style[data-emotion]').forEach(el => el.remove());
});

test('GlobalStyles injects color-scheme: light for a light theme', () => {
  const lightTheme = Theme.fromConfig({});

  act(() => {
    render(
      <ThemeProvider theme={lightTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
      container,
    );
  });

  expect(getInjectedCss()).toMatch(/color-scheme\s*:\s*light/);
});

test('GlobalStyles injects color-scheme: dark for a dark theme', () => {
  const darkTheme = Theme.fromConfig({ algorithm: ThemeAlgorithm.DARK });

  act(() => {
    render(
      <ThemeProvider theme={darkTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
      container,
    );
  });

  expect(getInjectedCss()).toMatch(/color-scheme\s*:\s*dark/);
});

/**
 * Embedded context simulation:
 * Embedded dashboards initialize with ThemeMode.DEFAULT (light). Without
 * an explicit color-scheme declaration, OS dark mode leaks into the iframe
 * and applies dark borders/scrollbars. This test verifies the injected CSS
 * declares color-scheme: light (preventing the OS preference from winning)
 * and explicitly does NOT declare color-scheme: dark.
 */
test('GlobalStyles prevents OS dark mode from affecting embedded light-mode dashboards', () => {
  // EmbeddedContextProviders always initializes with ThemeMode.DEFAULT (light theme)
  const embeddedLightTheme = Theme.fromConfig({});

  act(() => {
    render(
      <ThemeProvider theme={embeddedLightTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
      container,
    );
  });

  const css = getInjectedCss();
  // Must declare light to override any prefers-color-scheme: dark from OS
  expect(css).toMatch(/color-scheme\s*:\s*light/);
  // Must NOT declare dark — that would reproduce the original bug
  expect(css).not.toMatch(/color-scheme\s*:\s*dark/);
});

/**
 * Theme switching test:
 * Confirms that when the active theme changes from light to dark (e.g., via
 * the Switchboard setThemeMode API), the color-scheme declaration updates
 * accordingly so native browser UI stays in sync with the app theme.
 */
test('GlobalStyles updates color-scheme dynamically when theme switches light → dark', () => {
  const lightTheme = Theme.fromConfig({});
  const darkTheme = Theme.fromConfig({ algorithm: ThemeAlgorithm.DARK });

  // Initial render: light theme → color-scheme: light
  act(() => {
    render(
      <ThemeProvider theme={lightTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
      container,
    );
  });

  expect(getInjectedCss()).toMatch(/color-scheme\s*:\s*light/);

  // Clean up Emotion styles before re-rendering with dark theme
  document.querySelectorAll('style[data-emotion]').forEach(el => el.remove());

  // Re-render with dark theme → color-scheme: dark
  act(() => {
    render(
      <ThemeProvider theme={darkTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
      container,
    );
  });

  expect(getInjectedCss()).toMatch(/color-scheme\s*:\s*dark/);
});

test('GlobalStyles calls isThemeDark with the current theme to determine color-scheme', () => {
  const isThemeDarkSpy = jest.spyOn(themeUtils, 'isThemeDark');
  const lightTheme = Theme.fromConfig({});

  act(() => {
    render(
      <ThemeProvider theme={lightTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
      container,
    );
  });

  expect(isThemeDarkSpy).toHaveBeenCalledWith(lightTheme.theme);
  expect(isThemeDarkSpy).toHaveReturnedWith(false);
});

test('GlobalStyles detects dark theme via isThemeDark', () => {
  const isThemeDarkSpy = jest.spyOn(themeUtils, 'isThemeDark');
  const darkTheme = Theme.fromConfig({ algorithm: ThemeAlgorithm.DARK });

  act(() => {
    render(
      <ThemeProvider theme={darkTheme.theme}>
        <GlobalStyles />
      </ThemeProvider>,
      container,
    );
  });

  expect(isThemeDarkSpy).toHaveBeenCalledWith(darkTheme.theme);
  expect(isThemeDarkSpy).toHaveReturnedWith(true);
});
