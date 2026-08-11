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
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from '../DashboardProvider';
import { registerBuiltInBuildingBlocks } from '../registerBuiltInBuildingBlocks';
import TabsBlock from './TabsBlock';

const provider = DashboardProvider.getInstance();

beforeAll(() => {
  registerBuiltInBuildingBlocks();
});

beforeEach(() => {
  provider.reset();
});

/** Creates a bare `tabs` node under the root — rendering is each test's own call, made once its setup (if any) is done. */
const createTabs = (): string => {
  const rootId = provider.getRoot().id;
  return provider.addBuildingBlock(rootId, 0, { type: 'tabs' });
};

test('a freshly placed tabs block already has one tab, selected', () => {
  const tabsId = createTabs();
  render(<TabsBlock nodeId={tabsId} />);

  // A tabs block with nothing to switch between is not a useful starting
  // point, so this fills it in rather than leaving it for the "+" — see
  // TabsBlock's own layout effect.
  const tab = screen.getByRole('tab', { name: 'Tab 1' });
  expect(tab).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Nothing in this tab yet')).toBeVisible();

  const paneId = provider.getNode(tabsId)?.children?.[0] as string;
  expect(provider.getNode(paneId)?.props?.label).toBe('Tab 1');
  expect(screen.queryByTestId(`tab-remove-${paneId}`)).not.toBeInTheDocument();
});

test('adding a tab is named after its own position, not the count at click time', () => {
  const tabsId = createTabs();
  render(<TabsBlock nodeId={tabsId} />);

  // Tab 1 already exists (see the test above) — each click adds the next.
  fireEvent.click(screen.getByTestId(`tabs-add-${tabsId}`));
  fireEvent.click(screen.getByTestId(`tabs-add-${tabsId}`));

  expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Tab 3' })).toBeVisible();
});

test('the only tab offers no way to remove itself', () => {
  const tabsId = createTabs();
  render(<TabsBlock nodeId={tabsId} />);

  const paneId = provider.getNode(tabsId)?.children?.[0] as string;

  // Removing it would leave a blank tabs block the layout effect would
  // immediately refill anyway, which reads as the control having silently
  // done nothing.
  expect(screen.queryByTestId(`tab-remove-${paneId}`)).not.toBeInTheDocument();
});

test('a second tab can be removed, falling back to the remaining one', () => {
  const tabsId = createTabs();
  render(<TabsBlock nodeId={tabsId} />);
  const firstPaneId = provider.getNode(tabsId)?.children?.[0] as string;

  fireEvent.click(screen.getByTestId(`tabs-add-${tabsId}`));
  const secondTab = screen.getByRole('tab', { name: 'Tab 2' });
  fireEvent.click(secondTab);
  fireEvent.click(screen.getByTestId(`tab-remove-${provider.getNode(tabsId)?.children?.[1]}`));

  expect(screen.queryByRole('tab', { name: 'Tab 2' })).not.toBeInTheDocument();
  expect(provider.getNode(tabsId)?.children).toEqual([firstPaneId]);
  expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('dropping a palette block onto the active pane places it there', () => {
  const tabsId = createTabs();
  const paneId = provider.addBuildingBlock(tabsId, 0, {
    type: 'tab',
    props: { label: 'Overview' },
  });
  render(<TabsBlock nodeId={tabsId} />);

  const data = new Map([['application/x-dashboard-building-block', 'markdown']]);
  fireEvent.drop(screen.getByTestId(`tabs-panes-${tabsId}`), {
    dataTransfer: {
      types: [...data.keys()],
      getData: (key: string) => data.get(key) ?? '',
      dropEffect: '',
      effectAllowed: '',
    },
  });

  expect(provider.getNode(paneId)?.children).toHaveLength(1);
  const droppedId = provider.getNode(paneId)?.children?.[0] as string;
  expect(provider.getNode(droppedId)?.type).toBe('markdown');
});

test('clicking a tab shows its own content and hides the other panes', async () => {
  const tabsId = createTabs();
  const firstPane = provider.addBuildingBlock(tabsId, 0, {
    type: 'tab',
    props: { label: 'Overview' },
  });
  const secondPane = provider.addBuildingBlock(tabsId, 1, {
    type: 'tab',
    props: { label: 'Detail' },
  });
  provider.addBuildingBlock(firstPane, 0, {
    type: 'markdown',
    props: { content: 'Overview content' },
  });
  provider.addBuildingBlock(secondPane, 0, {
    type: 'markdown',
    props: { content: 'Detail content' },
  });
  render(<TabsBlock nodeId={tabsId} />);

  // The first pane is active by default. `findByText` rather than
  // `getByText`: `SafeMarkdown` lazy-loads `react-markdown` itself and
  // renders nothing until that resolves, so the text is not necessarily
  // there yet on the tick right after `render`.
  expect(await screen.findByText('Overview content')).toBeVisible();
  expect(screen.queryByText('Detail content')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Detail' }));

  expect(screen.queryByText('Overview content')).not.toBeInTheDocument();
  expect(await screen.findByText('Detail content')).toBeVisible();
});

test('a flowed block with no height of its own flexes to fill the area, and fixes to a number once grown from the keyboard', () => {
  const tabsId = createTabs();
  const pane = provider.addBuildingBlock(tabsId, 0, {
    type: 'tab',
    props: { label: 'Overview' },
  });
  const chartId = provider.addBuildingBlock(pane, 0, {
    type: 'markdown',
    props: { content: 'Chart stand-in' },
  });
  render(<TabsBlock nodeId={tabsId} />);

  const handle = screen.getByTestId(`flow-resize-${chartId}`);
  // No `rowSpan` of its own yet, so there is no number to report — the
  // block is flexing to fill the area rather than sitting at a fixed size.
  expect(handle).not.toHaveAttribute('aria-valuenow');

  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowDown' });

  // The first resize is what fixes it to an explicit size — measured off
  // the rendered box in a real browser, or `DEFAULT_FLOW_ITEM_HEIGHT` here,
  // where nothing is actually laid out to measure.
  expect(handle).toHaveAttribute('aria-valuenow', '376');
  expect(provider.getNode(chartId)?.layout?.rowSpan).toBe(376);
});

test('a flowed block cannot be shrunk past the minimum height', () => {
  const tabsId = createTabs();
  const pane = provider.addBuildingBlock(tabsId, 0, {
    type: 'tab',
    props: { label: 'Overview' },
  });
  const chartId = provider.addBuildingBlock(pane, 0, {
    type: 'markdown',
    layout: { rowSpan: 124 },
    props: { content: 'Chart stand-in' },
  });
  render(<TabsBlock nodeId={tabsId} />);

  const handle = screen.getByTestId(`flow-resize-${chartId}`);
  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowUp' });
  fireEvent.keyDown(handle, { key: 'ArrowUp' });

  expect(provider.getNode(chartId)?.layout?.rowSpan).toBe(120);
});

test('removing the active pane falls back to the first remaining tab', () => {
  const tabsId = createTabs();
  provider.addBuildingBlock(tabsId, 0, {
    type: 'tab',
    props: { label: 'Overview' },
  });
  const detailPane = provider.addBuildingBlock(tabsId, 1, {
    type: 'tab',
    props: { label: 'Detail' },
  });
  render(<TabsBlock nodeId={tabsId} />);

  fireEvent.click(screen.getByRole('tab', { name: 'Detail' }));
  act(() => provider.removeBuildingBlock(detailPane));

  expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
