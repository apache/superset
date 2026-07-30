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
import { render, screen, act } from '@testing-library/react';
import { theme as antdThemeImport } from 'antd';
import { Theme } from './Theme';

// SupersetThemeProvider stores theme state via React.useState, then
// overrides Theme#updateProviders (a no-op by default) to call setThemeState
// whenever a *later* call to setConfig/toggleDarkMode runs on the same
// instance. Consumers (docs/src/components/StorybookWrapper.jsx in
// particular) rely on this: they call toggleDarkMode() from outside, on an
// already-mounted provider, expecting it to propagate.
//
// The probe below reads the theme via antd's theme.useToken() -- the same
// context-consumption path every real antd component (Button, Input, ...)
// uses internally -- rather than reading themeObject.theme directly off the
// singleton. That distinction matters: React bails out of re-rendering a
// child whose element reference didn't change (the common "static children
// prop" case, true here since <Probe /> is passed once and never
// recreated), UNLESS that child consumes a React Context whose value
// changed, which bypasses the bail-out. A probe reading the plain object
// directly would misleadingly appear "not updated" even though every real
// themed component downstream re-renders correctly.
test('an already-mounted SupersetThemeProvider re-renders context-consuming children when toggleDarkMode is called on the same instance', () => {
  const themeObject = Theme.fromConfig();
  let renderCount = 0;
  let lastColorBgBase: string | undefined;

  function Probe() {
    const { token } = antdThemeImport.useToken();
    renderCount += 1;
    lastColorBgBase = token.colorBgBase;
    return <div data-test="probe" />;
  }

  render(
    <themeObject.SupersetThemeProvider>
      <Probe />
    </themeObject.SupersetThemeProvider>,
  );

  expect(screen.getByTestId('probe')).toBeTruthy();
  const rendersBefore = renderCount;
  const tokenBefore = lastColorBgBase;

  act(() => {
    themeObject.toggleDarkMode(true);
  });

  expect(renderCount).toBeGreaterThan(rendersBefore);
  expect(lastColorBgBase).not.toBe(tokenBefore);
});

test('a toggleDarkMode call on an unmounted (or different) theme instance does not affect a mounted provider', () => {
  const mounted = Theme.fromConfig();
  const other = Theme.fromConfig();
  let renderCount = 0;
  let lastColorBgBase: string | undefined;

  function Probe() {
    const { token } = antdThemeImport.useToken();
    renderCount += 1;
    lastColorBgBase = token.colorBgBase;
    return <div data-test="probe" />;
  }

  render(
    <mounted.SupersetThemeProvider>
      <Probe />
    </mounted.SupersetThemeProvider>,
  );

  const rendersBefore = renderCount;
  const tokenBefore = lastColorBgBase;

  act(() => {
    other.toggleDarkMode(true);
  });

  // Each Theme instance owns its own updateProviders override; toggling a
  // *different* instance must not re-render a provider mounted from another.
  expect(renderCount).toBe(rendersBefore);
  expect(lastColorBgBase).toBe(tokenBefore);
});
