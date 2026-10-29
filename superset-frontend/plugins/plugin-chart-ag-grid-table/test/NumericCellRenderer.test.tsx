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
import { render } from '@superset-ui/core/spec';
import { NumericCellRenderer } from '../src/renderers/NumericCellRenderer';

const renderCell = (horizontalAlign?: string) => {
  const params = {
    value: 42,
    valueFormatted: '42',
    node: { rowPinned: undefined, rowIndex: 0 },
    hasBasicColorFormatters: false,
    basicColorFormatters: [],
    col: {
      isNumeric: true,
      config: horizontalAlign ? { horizontalAlign } : {},
    },
    valueRange: undefined,
    alignPositiveNegative: false,
    colorPositiveNegative: false,
  } as unknown as Parameters<typeof NumericCellRenderer>[0];
  return render(<NumericCellRenderer {...params} />);
};

const collectInjectedCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map(style => style.textContent ?? '')
    .join('\n');

test('applies an allowed horizontalAlign value from column config', () => {
  const { container } = renderCell('center');
  expect(container.firstChild).toHaveStyle({ justifyContent: 'center' });
});

test('does not compile a malicious horizontalAlign into the stylesheet', () => {
  const payload =
    'right;} & { position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:99999; background:#fff url(https://attacker.example/beacon) }';
  const { container } = renderCell(payload);
  const css = collectInjectedCss();
  expect(css).not.toContain('position:fixed');
  expect(css).not.toContain('attacker.example');
  expect(container.firstChild).toHaveStyle({ justifyContent: 'left' });
});
