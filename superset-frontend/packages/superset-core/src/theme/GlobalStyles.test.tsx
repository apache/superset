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
import { render } from '@testing-library/react';
import { GlobalStyles } from './GlobalStyles';
import { Theme } from './Theme';

// Locks in the app shell's CSS contract (superset#44867): body/#app must stay
// a growable min-height:100vh flex column, not a fixed height:100% box, or
// content a host page injects above #app clips past the viewport again.
// Emotion inserts rules via the CSSOM (sheet.insertRule) rather than setting
// <style> textContent, so the rules must be read from document.styleSheets.
function findRule(selectorText: string): string {
  const themeObject = Theme.fromConfig();
  render(
    <themeObject.SupersetThemeProvider>
      <GlobalStyles />
    </themeObject.SupersetThemeProvider>,
  );
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if ((rule as CSSStyleRule).selectorText === selectorText) {
        return rule.cssText;
      }
    }
  }
  throw new Error(`No rule found for selector ${selectorText}`);
}

test('body is a growable min-height flex column, not a fixed-height box', () => {
  const bodyRule = findRule('body');

  expect(bodyRule).toMatch(/min-height:\s*100vh/);
  expect(bodyRule).toMatch(/display:\s*flex/);
  expect(bodyRule).toMatch(/flex-direction:\s*column/);
  // The pre-#44867 shell fixed body to exactly 100% of the viewport, which
  // clips rather than grows when a host page injects content above #app.
  expect(bodyRule).not.toMatch(/\bheight:\s*100%/);
});

test('#app has no explicit height, so it flex-grows into the space body leaves it', () => {
  const appRule = findRule('#app');

  expect(appRule).toMatch(/flex:\s*1 1 auto/);
  expect(appRule).not.toMatch(/\bheight:\s*100%/);
});
