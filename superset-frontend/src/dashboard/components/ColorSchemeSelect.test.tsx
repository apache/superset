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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  CategoricalD3,
  CategoricalModernSunset,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import ColorSchemeSelect from './ColorSchemeSelect';

const openAndGetPopup = async () => {
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Select color scheme' }),
  );
  await waitFor(() =>
    expect(document.querySelector('.ant-select-dropdown')).toBeInTheDocument(),
  );
  return document.querySelector('.ant-select-dropdown') as HTMLElement;
};

test('portals the palette inside the enclosing modal container', async () => {
  render(
    <div className="ant-modal-container" data-test="modal">
      <ColorSchemeSelect onChange={jest.fn()} />
    </div>,
  );
  const popup = await openAndGetPopup();
  expect(screen.getByTestId('modal').contains(popup)).toBe(true);
});

test('portals the palette to document.body outside a modal', async () => {
  render(
    <div data-test="wrapper">
      <ColorSchemeSelect onChange={jest.fn()} />
    </div>,
  );
  const popup = await openAndGetPopup();
  expect(screen.getByTestId('wrapper').contains(popup)).toBe(false);
  expect(document.body.contains(popup)).toBe(true);
});

test('attaches the grouped-option styles to the popup root', async () => {
  [...CategoricalD3, ...CategoricalModernSunset].forEach(scheme =>
    getCategoricalSchemeRegistry().registerValue(scheme.id, scheme),
  );
  render(<ColorSchemeSelect onChange={jest.fn()} />);
  const popup = await openAndGetPopup();
  await waitFor(() =>
    expect(screen.getByText('Featured color palettes')).toBeInTheDocument(),
  );
  // The popup portals out of the css-prop scope, so the grouped styles ride
  // on an emotion class attached to the popup root.
  const emotionClass = Array.from(popup.classList).find(cls =>
    /^(superset|css)-(?!dev-only|var)/.test(cls),
  );
  expect(emotionClass).toBeDefined();
  const styleText = Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText))
    .join('\n');
  expect(styleText).toContain(
    `.${emotionClass} .ant-select-item-option-grouped`,
  );
});
