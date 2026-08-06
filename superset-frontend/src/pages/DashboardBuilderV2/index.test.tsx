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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import DashboardBuilderV2 from '.';

jest.mock('src/core/chat', () => ({
  chat: { registerClientTools: () => ({ dispose: () => {} }) },
}));

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const renderPage = () => render(<DashboardBuilderV2 />, { useRedux: true });

test('a blank dashboard can still be reached, and so can the layout it arranges in', async () => {
  renderPage();

  // The canvas is no longer chat-only: a palette sits beside it, so the
  // empty state names both ways in.
  expect(
    screen.getByText('Add a building block, or ask the assistant to start'),
  ).toBeInTheDocument();

  // A `/dashboard/v2/new/` load lands on nothing, and that is exactly when
  // someone reaches for the layout control: whatever is placed next lands in
  // the mode already chosen, rather than being placed and then rearranged.
  // Arranging is asked in the root's own properties, so the blank canvas has
  // to be selectable or the mode is unreachable until something is placed.
  await userEvent.click(screen.getByTestId('empty-canvas'));

  expect(provider.getSelection()).toBe(provider.getRoot().id);
  expect(screen.getByTestId('layout-mode-switcher')).toBeInTheDocument();
});

test('selecting the root offers the layout once blocks have been placed too', async () => {
  provider.addBuildingBlock(provider.getRoot().id, 0, { type: 'markdown' });
  renderPage();

  provider.setSelection(provider.getRoot().id);

  expect(await screen.findByTestId('layout-mode-switcher')).toBeInTheDocument();
});

test('the canvas carries the route to how it is arranged', async () => {
  provider.addBuildingBlock(provider.getRoot().id, 0, { type: 'markdown' });
  renderPage();

  // On the thing it arranges rather than on the bar above it: choosing how
  // blocks lay out is done while looking at the blocks, and the control it
  // leads to is one selection away in the root's own properties.
  await userEvent.click(screen.getByTestId('canvas-arrange'));

  expect(provider.getSelection()).toBe(provider.getRoot().id);
  expect(screen.getByTestId('layout-mode-switcher')).toBeInTheDocument();
});

test('the arrange shortcut is offered on a blank canvas too', () => {
  renderPage();

  // A blank dashboard is exactly when the mode is chosen — whatever is placed
  // next lands in it.
  expect(screen.getByTestId('canvas-arrange')).toBeInTheDocument();
});

test('refreshing sits with arranging, and is honest about not working', () => {
  renderPage();

  // Both act on the canvas as a whole rather than on anything placed in it,
  // so they are reached for from the same corner. Refreshing is still the
  // affordance this builder cannot honour: there is no dashboard row behind
  // the page and nothing to re-read.
  expect(screen.getByTestId('canvas-refresh')).toBeDisabled();
});

test('the page is a header, an editor panel and a canvas', () => {
  renderPage();

  expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
  expect(screen.getByTestId('editor-panel')).toBeInTheDocument();
  expect(screen.getByTestId('canvas')).toBeInTheDocument();
});

test('placing a block from the palette puts it on the dashboard and selects it', async () => {
  renderPage();

  await userEvent.click(screen.getByTestId('palette-markdown'));

  const children = provider.getRoot().children ?? [];
  expect(children).toHaveLength(1);
  // Placing something is the moment you want to configure it, which is also
  // what brings Properties forward.
  expect(provider.getSelection()).toBe(children[0]);
});

test('a block placed while a container is selected goes inside it', async () => {
  renderPage();
  await userEvent.click(screen.getByTestId('palette-canvas'));
  const sectionId = provider.getSelection()!;

  await userEvent.click(screen.getByTestId('palette-markdown'));

  // An author who has just selected a section and reaches for a block means
  // to put it in that section.
  expect(provider.getNode(sectionId)?.children).toEqual([
    provider.getSelection(),
  ]);
  expect(provider.getRoot().children).toEqual([sectionId]);
});

test('a block placed while a leaf is selected goes beside it, not inside it', async () => {
  renderPage();
  await userEvent.click(screen.getByTestId('palette-markdown'));
  const firstId = provider.getSelection()!;

  await userEvent.click(screen.getByTestId('palette-echarts'));

  expect(provider.getRoot().children).toEqual([
    firstId,
    provider.getSelection(),
  ]);
});

test('clicking the canvas itself clears the selection', async () => {
  renderPage();
  await userEvent.click(screen.getByTestId('palette-markdown'));
  expect(provider.getSelection()).toBeDefined();

  await userEvent.click(screen.getByTestId('canvas'));

  // A click that reached the canvas passed every block on the way, so it is
  // the one gesture that unambiguously means "nothing".
  expect(provider.getSelection()).toBeUndefined();
});
