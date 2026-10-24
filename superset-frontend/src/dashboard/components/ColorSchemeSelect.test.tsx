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
