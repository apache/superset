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
import { useLayoutEffect, type ReactNode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { theme as antdThemeImport } from 'antd';
import { Theme } from './Theme';

// SupersetThemeProvider stores theme state via React.useState, then
// registers a listener (in a useLayoutEffect, on mount) that calls
// setThemeState whenever a *later* call to setConfig/toggleDarkMode runs
// on the same Theme instance. Every provider currently mounted from that
// instance listens independently, so toggling the instance updates all of
// them, not just the most recently rendered one. Consumers
// (docs/src/components/StorybookWrapper.jsx in particular) rely on this:
// they call toggleDarkMode() from outside, on one or more already-mounted
// providers sharing a single Theme instance, expecting it to propagate to
// all of them.
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
function makeProbe() {
  let renderCount = 0;
  let lastColorBgBase: string | undefined;
  function Probe() {
    const { token } = antdThemeImport.useToken();
    renderCount += 1;
    lastColorBgBase = token.colorBgBase;
    return <div data-test="probe" />;
  }
  return {
    Probe,
    getRenderCount: () => renderCount,
    getLastColorBgBase: () => lastColorBgBase,
  };
}

test('an already-mounted SupersetThemeProvider re-renders context-consuming children when toggleDarkMode is called on the same instance', () => {
  const themeObject = Theme.fromConfig();
  const { Probe, getRenderCount, getLastColorBgBase } = makeProbe();

  render(
    <themeObject.SupersetThemeProvider>
      <Probe />
    </themeObject.SupersetThemeProvider>,
  );

  expect(screen.getByTestId('probe')).toBeTruthy();
  const rendersBefore = getRenderCount();
  const tokenBefore = getLastColorBgBase();

  act(() => {
    themeObject.toggleDarkMode(true);
  });

  expect(getRenderCount()).toBeGreaterThan(rendersBefore);
  expect(getLastColorBgBase()).not.toBe(tokenBefore);
});

test('toggleDarkMode updates every concurrently mounted provider for the same theme instance', () => {
  const themeObject = Theme.fromConfig();
  const first = makeProbe();
  const second = makeProbe();

  render(
    <>
      <themeObject.SupersetThemeProvider>
        <first.Probe />
      </themeObject.SupersetThemeProvider>
      <themeObject.SupersetThemeProvider>
        <second.Probe />
      </themeObject.SupersetThemeProvider>
    </>,
  );

  const firstTokenBefore = first.getLastColorBgBase();
  const secondTokenBefore = second.getLastColorBgBase();

  act(() => {
    themeObject.toggleDarkMode(true);
  });

  // Both providers share the same Theme instance, so both must pick up the
  // toggle -- not just whichever one rendered last.
  expect(first.getLastColorBgBase()).not.toBe(firstTokenBefore);
  expect(second.getLastColorBgBase()).not.toBe(secondTokenBefore);
});

test('a toggleDarkMode call on a different theme instance does not affect a mounted provider', () => {
  const mounted = Theme.fromConfig();
  const other = Theme.fromConfig();
  const { Probe, getRenderCount, getLastColorBgBase } = makeProbe();

  render(
    <mounted.SupersetThemeProvider>
      <Probe />
    </mounted.SupersetThemeProvider>,
  );

  const rendersBefore = getRenderCount();
  const tokenBefore = getLastColorBgBase();

  act(() => {
    other.toggleDarkMode(true);
  });

  // Each Theme instance owns its own set of provider listeners; toggling a
  // *different* instance must not re-render a provider mounted from another.
  expect(getRenderCount()).toBe(rendersBefore);
  expect(getLastColorBgBase()).toBe(tokenBefore);
});

test('a toggleDarkMode call after a provider unmounts does not throw and no longer updates it', () => {
  const themeObject = Theme.fromConfig();
  const { Probe, getRenderCount, getLastColorBgBase } = makeProbe();

  const { unmount } = render(
    <themeObject.SupersetThemeProvider>
      <Probe />
    </themeObject.SupersetThemeProvider>,
  );

  const rendersBefore = getRenderCount();
  const tokenBefore = getLastColorBgBase();

  unmount();

  expect(() => {
    act(() => {
      themeObject.toggleDarkMode(true);
    });
  }).not.toThrow();

  // The unmounted provider's listener was deregistered, so it shouldn't
  // have re-rendered (or updated) in response to the toggle.
  expect(getRenderCount()).toBe(rendersBefore);
  expect(getLastColorBgBase()).toBe(tokenBefore);
});

test('a toggleDarkMode call from an ancestor layout effect during the initial commit is not dropped', () => {
  // Regression harness for the initial-mount race: StorybookWrapper.jsx
  // toggles the singleton from its own layout effect (ThemeSync) as soon
  // as a demo mounts. SupersetThemeProvider must have its listener
  // registered *before* that ancestor effect fires, which only holds if
  // registration itself runs in a layout effect -- layout effects fire
  // bottom-up, so this component (nested inside the toggling ancestor)
  // registers first. If that registration ever regresses to a plain
  // useEffect, it runs after the ancestor's toggle (passive effects are
  // deferred until after all layout effects), the notification is
  // dropped, and this probe would still show the pre-toggle palette.
  const lightBaseline = Theme.fromConfig();
  const baseline = makeProbe();

  render(
    <lightBaseline.SupersetThemeProvider>
      <baseline.Probe />
    </lightBaseline.SupersetThemeProvider>,
  );

  const lightColorBgBase = baseline.getLastColorBgBase();

  const themeObject = Theme.fromConfig();
  const { Probe, getLastColorBgBase } = makeProbe();

  function AncestorToggler({ children }: { children: ReactNode }) {
    useLayoutEffect(() => {
      themeObject.toggleDarkMode(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return children;
  }

  render(
    <AncestorToggler>
      <themeObject.SupersetThemeProvider>
        <Probe />
      </themeObject.SupersetThemeProvider>
    </AncestorToggler>,
  );

  expect(getLastColorBgBase()).not.toBe(lightColorBgBase);
});
