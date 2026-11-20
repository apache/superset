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

/**
 * The order of these options is meaningful — the server returns the everyday
 * profile first and the slower, more thorough ones after — and it kept changing
 * when a profile was picked. The shared `Select` sorts the chosen option to the
 * top of its own list, independently of any `sortComparator`, which is why this
 * is a dropdown instead.
 */

import userEvent from '@testing-library/user-event';
import { render, screen, within } from 'spec/helpers/testing-library';
import ChatAgentSelect from './ChatAgentSelect';
import type { AiAgent } from '../types';

/** Deliberately not alphabetical, so a re-sort is visible. */
const AGENTS: AiAgent[] = [
  {
    key: 'default',
    name: 'Default',
    description: 'Everyday questions',
    tools: [],
  },
  {
    key: 'analyst',
    name: 'Data Analyst',
    description: 'Deeper analysis',
    tools: ['execute_sql'],
  },
  {
    key: 'legacy',
    name: 'Legacy',
    description: 'The older profile',
    tools: [],
  },
];

const optionNames = (): string[] =>
  screen
    .getAllByTestId('chat-agent-option-name')
    .map(name => name.textContent ?? '');

const openMenu = async () => {
  await userEvent.click(screen.getByTestId('chat-agent-trigger'));
};

test('the menu keeps the order it was given', async () => {
  render(
    <ChatAgentSelect
      agents={AGENTS}
      selectedAgent="default"
      onChange={jest.fn()}
    />,
  );

  await openMenu();

  expect(optionNames()).toEqual(['Default', 'Data Analyst', 'Legacy']);
});

test('choosing a profile does not move it up the list', async () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <ChatAgentSelect
      agents={AGENTS}
      selectedAgent="default"
      onChange={onChange}
    />,
  );

  await openMenu();
  await userEvent.click(screen.getByText('Legacy'));
  expect(onChange).toHaveBeenCalledWith('legacy');

  // Re-rendered as the panel would once the choice is held in state.
  rerender(
    <ChatAgentSelect
      agents={AGENTS}
      selectedAgent="legacy"
      onChange={onChange}
    />,
  );

  await openMenu();
  expect(optionNames()).toEqual(['Default', 'Data Analyst', 'Legacy']);
});

test('the chosen profile is the one marked selected', async () => {
  render(
    <ChatAgentSelect
      agents={AGENTS}
      selectedAgent="analyst"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByTestId('chat-agent-trigger')).toHaveTextContent(
    'Data Analyst',
  );

  await openMenu();

  // Options are native buttons rather than ARIA `option`s: a button is already
  // focusable and announced, and `role="option"` would take on a listbox
  // keyboard contract this does not implement.
  const menu = screen.getByTestId('chat-agent-menu');
  const pressed = within(menu)
    .getAllByRole('button')
    .filter(option => option.getAttribute('aria-pressed') === 'true');
  expect(pressed).toHaveLength(1);
  expect(pressed[0]).toHaveTextContent('Data Analyst');
});

test('each profile explains itself without needing a hover', async () => {
  render(
    <ChatAgentSelect
      agents={AGENTS}
      selectedAgent="default"
      onChange={jest.fn()}
    />,
  );

  await openMenu();

  // A tooltip is not a good home for the one thing that says what a profile can
  // reach, so the description is rendered under the name.
  expect(screen.getByText('Everyday questions')).toBeInTheDocument();
  expect(screen.getByText('Deeper analysis')).toBeInTheDocument();
});

test('a profile without a description still renders', async () => {
  render(
    <ChatAgentSelect
      agents={[{ key: 'bare', name: 'Bare', tools: [] }]}
      selectedAgent="bare"
      onChange={jest.fn()}
    />,
  );

  await openMenu();

  const menu = screen.getByTestId('chat-agent-menu');
  expect(within(menu).getByRole('button')).toHaveTextContent('Bare');
});
