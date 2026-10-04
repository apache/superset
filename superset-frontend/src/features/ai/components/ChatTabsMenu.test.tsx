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
  within,
} from 'spec/helpers/testing-library';
import ChatTabsMenu, { formatRelativeTime } from './ChatTabsMenu';
import type { ChatTab } from '../types';

const MINUTE_MS = 60_000;

const tab = (overrides: Partial<ChatTab> = {}): ChatTab => ({
  id: 'tab-1',
  name: 'Revenue question',
  messages: [],
  createdAt: Date.now(),
  ...overrides,
});

const handlers = () => ({
  onSelectTab: jest.fn(),
  onNewChat: jest.fn(),
  onDeleteTab: jest.fn(),
  onRenameTab: jest.fn(),
});

const openMenu = async (
  tabs: ChatTab[],
  props: ReturnType<typeof handlers>,
) => {
  render(<ChatTabsMenu tabs={tabs} activeTabId="tab-1" {...props} />, {
    useRedux: true,
  });
  await userEvent.click(screen.getByTestId('chat-tabs-trigger'));
  return screen.findByTestId('chat-tabs-menu');
};

test('the menu lists conversations and can start a new one', async () => {
  const props = handlers();
  const menu = await openMenu([tab()], props);

  expect(within(menu).getByText('Revenue question')).toBeInTheDocument();

  await userEvent.click(within(menu).getByText('New Chat'));

  expect(props.onNewChat).toHaveBeenCalled();
});

test('selecting a conversation reports which one', async () => {
  const props = handlers();
  const menu = await openMenu(
    [tab(), tab({ id: 'tab-2', name: 'Other' })],
    props,
  );

  await userEvent.click(within(menu).getByText('Other'));

  expect(props.onSelectTab).toHaveBeenCalledWith('tab-2');
});

test('an empty conversation is deleted without a confirmation', async () => {
  const props = handlers();
  const menu = await openMenu([tab()], props);

  await userEvent.click(within(menu).getByLabelText('Delete conversation'));

  // Nothing was said in it, so there is nothing to lose.
  expect(props.onDeleteTab).toHaveBeenCalledWith('tab-1');
});

test('a conversation with messages is confirmed before deletion', async () => {
  const props = handlers();
  const menu = await openMenu(
    [
      tab({
        messages: [
          { id: 'm1', role: 'user', content: 'hi', timestamp: Date.now() },
        ],
      }),
    ],
    props,
  );

  await userEvent.click(within(menu).getByLabelText('Delete conversation'));

  expect(props.onDeleteTab).not.toHaveBeenCalled();
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(props.onDeleteTab).toHaveBeenCalledWith('tab-1');
});

test('renaming commits on Enter', async () => {
  const props = handlers();
  const menu = await openMenu([tab()], props);

  await userEvent.click(within(menu).getByLabelText('Rename conversation'));
  const input = within(menu).getByLabelText('Conversation name');
  await userEvent.clear(input);
  await userEvent.type(input, 'Renamed{enter}');

  expect(props.onRenameTab).toHaveBeenCalledWith('tab-1', 'Renamed');
});

test('renaming is abandoned on Escape', async () => {
  const props = handlers();
  const menu = await openMenu([tab()], props);

  await userEvent.click(within(menu).getByLabelText('Rename conversation'));
  const input = within(menu).getByLabelText('Conversation name');
  await userEvent.clear(input);
  await userEvent.type(input, 'Discarded{esc}');

  expect(props.onRenameTab).not.toHaveBeenCalled();
  expect(within(menu).getByText('Revenue question')).toBeInTheDocument();
});

test('a blank rename is ignored', async () => {
  const props = handlers();
  const menu = await openMenu([tab()], props);

  await userEvent.click(within(menu).getByLabelText('Rename conversation'));
  const input = within(menu).getByLabelText('Conversation name');
  await userEvent.clear(input);
  await userEvent.type(input, '   {enter}');

  // Committing this would leave a conversation with no name in the list.
  expect(props.onRenameTab).not.toHaveBeenCalled();
});

test('an empty list says so rather than looking broken', async () => {
  const props = handlers();
  const menu = await openMenu([], props);

  expect(within(menu).getByText('No conversations yet')).toBeInTheDocument();
});

test('timestamps read as relative ages, then as dates', () => {
  const now = Date.now();

  expect(formatRelativeTime(now)).toBe('just now');
  expect(formatRelativeTime(now - 5 * MINUTE_MS)).toBe('5m');
  expect(formatRelativeTime(now - 3 * 60 * MINUTE_MS)).toBe('3h');
  expect(formatRelativeTime(now - 3 * 24 * 60 * MINUTE_MS)).toBe('3d');
  // Past a week a relative age stops being informative.
  expect(formatRelativeTime(now - 30 * 24 * 60 * MINUTE_MS)).toMatch(/\w+ \d+/);
});
