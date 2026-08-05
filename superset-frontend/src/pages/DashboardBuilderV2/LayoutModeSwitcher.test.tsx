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
import LayoutModeSwitcher from './LayoutModeSwitcher';

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const mount = () => {
  const rootId = provider.getRoot().id;
  provider.addBuildingBlock(rootId, 0, { type: 'markdown' });
  render(<LayoutModeSwitcher nodeId={rootId} />);
  return rootId;
};

test('a container that never named a mode reads as a grid', () => {
  mount();

  // Not a default the control invents for display: it is the mode the
  // container actually arranges in, so the button and the canvas agree.
  expect(screen.getByTestId('layout-mode-grid')).toBeChecked();
});

test('choosing a mode writes it to the container', async () => {
  const rootId = mount();

  await userEvent.click(screen.getByTestId('layout-mode-flex'));

  expect(provider.getNode(rootId)?.layout?.mode).toBe('flex');
});

test('the control follows a mode set anywhere else', () => {
  const rootId = provider.getRoot().id;
  provider.addBuildingBlock(rootId, 0, { type: 'markdown' });
  provider.updateLayout(rootId, { mode: 'free' });

  render(<LayoutModeSwitcher nodeId={rootId} />);

  // `updateLayout` is what an AI tool call goes through. Asking the
  // assistant for a free canvas and pressing Free are the same edit, so the
  // control has to reflect whichever happened last rather than its own idea.
  expect(screen.getByTestId('layout-mode-free')).toBeChecked();
});

test('changing the mode leaves every block where it was', async () => {
  const rootId = provider.getRoot().id;
  const blockId = provider.addBuildingBlock(rootId, 0, {
    type: 'markdown',
    layout: { col: 3, row: 2, colSpan: 6, rowSpan: 4 },
  });
  render(<LayoutModeSwitcher nodeId={rootId} />);

  await userEvent.click(screen.getByTestId('layout-mode-flex'));
  await userEvent.click(screen.getByTestId('layout-mode-grid'));

  // Grid and Free read the same four coordinates and Flex ignores them, so
  // a round trip through Flex must not be where a position quietly dies.
  expect(provider.getNode(blockId)?.layout).toMatchObject({
    col: 3,
    row: 2,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('a node that holds no children offers no arrangement', () => {
  const rootId = provider.getRoot().id;
  const leafId = provider.addBuildingBlock(rootId, 0, { type: 'markdown' });

  render(<LayoutModeSwitcher nodeId={leafId} />);

  // A leaf arranges nothing. Offering it a layout mode would be offering a
  // setting with nothing to apply to.
  expect(screen.queryByTestId('layout-mode-switcher')).not.toBeInTheDocument();
});
