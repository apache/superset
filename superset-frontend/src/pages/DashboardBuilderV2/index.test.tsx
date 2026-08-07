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
import { act, render, screen } from 'spec/helpers/testing-library';
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

test('a blank dashboard can still be reached', async () => {
  renderPage();

  // The canvas is no longer chat-only: a palette sits beside it, so the
  // empty state names both ways in.
  expect(
    screen.getByText(
      'Drag a building block from the panel, or ask the assistant for one.',
    ),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByTestId('empty-canvas'));

  expect(provider.getSelection()).toBe(provider.getRoot().id);
});

test('the canvas has no arrange shortcut, since the layout it once opened is gone', () => {
  renderPage();

  expect(screen.queryByTestId('canvas-arrange')).not.toBeInTheDocument();
});

test('refreshing is honest about not working', () => {
  renderPage();

  // There is no dashboard row behind this page and nothing to re-read, so
  // it says so rather than doing nothing quietly.
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
  // Canvas is not on the palette, but a container can still exist — placed
  // by the assistant, or carried over from before this UI stopped offering
  // it — and a block placed into a selected one still goes inside it.
  const sectionId = provider.addBuildingBlock(provider.getRoot().id, 0, {
    type: 'canvas',
  });
  act(() => provider.setSelection(sectionId));

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
