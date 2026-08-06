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
import DashboardHeader from './DashboardHeader';

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

test('the header carries the dashboard-level affordances', () => {
  render(<DashboardHeader />);

  expect(screen.getByTestId('header-templates')).toBeInTheDocument();
  expect(screen.getByTestId('header-history')).toBeInTheDocument();
  expect(screen.getByTestId('header-favorite')).toBeInTheDocument();
  expect(screen.getByTestId('header-published')).toHaveTextContent('Draft');
  expect(screen.getByTestId('header-refresh')).toBeInTheDocument();
  expect(screen.getByTestId('header-undo')).toBeInTheDocument();
  expect(screen.getByTestId('header-redo')).toBeInTheDocument();
  expect(screen.getByTestId('header-save')).toBeInTheDocument();
});

test('everything the builder cannot actually do is disabled, not silently dead', () => {
  render(<DashboardHeader />);

  // The builder keeps its tree in memory with no dashboard row behind it:
  // nothing here can be saved, favourited, published or refreshed, and there
  // is no history to step through. A control that looks live and does
  // nothing teaches something false about all of them.
  [
    'header-templates',
    'header-history',
    'header-favorite',
    'header-refresh',
    'header-undo',
    'header-redo',
    'header-save',
  ].forEach(test => expect(screen.getByTestId(test)).toBeDisabled());
});

test('the layout switcher is the one live control, and it edits the tree', async () => {
  render(<DashboardHeader />);
  const rootId = provider.getRoot().id;

  // Live precisely because its state is in the tree rather than in a row
  // this page does not have.
  await userEvent.click(screen.getByTestId('layout-mode-flex'));

  expect(provider.getNode(rootId)?.layout?.mode).toBe('flex');
});

test('the dashboard is nameable, and the name is stored on the dashboard', async () => {
  render(<DashboardHeader />);

  await userEvent.type(screen.getByTestId('header-title'), 'Vaccine rollout');
  await userEvent.tab();

  // On the root node rather than in this component's state: a name is
  // something the dashboard has, so the assistant can read and rename it too.
  expect(provider.getRoot().props?.title).toBe('Vaccine rollout');
});

test('the title shows a rename made anywhere else', () => {
  provider.updateProps(provider.getRoot().id, { title: 'From the assistant' });

  render(<DashboardHeader />);

  expect(screen.getByTestId('header-title')).toHaveValue('From the assistant');
});

test('emptying the title is not a rename', async () => {
  provider.updateProps(provider.getRoot().id, { title: 'Quarterly review' });
  render(<DashboardHeader />);

  await userEvent.clear(screen.getByTestId('header-title'));
  await userEvent.tab();

  // A stray select-all-and-delete must not silently leave the dashboard
  // nameless; the field goes back to what the dashboard is still called.
  expect(provider.getRoot().props?.title).toBe('Quarterly review');
  expect(screen.getByTestId('header-title')).toHaveValue('Quarterly review');
});
