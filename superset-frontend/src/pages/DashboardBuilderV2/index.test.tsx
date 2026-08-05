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

test('a blank dashboard still offers a layout to arrange it in', () => {
  render(<DashboardBuilderV2 />);

  // The page a `/dashboard/v2/new/` load lands on has nothing on it yet, and
  // that is exactly when someone reaches for the layout control: whatever is
  // placed next lands in the mode already chosen, rather than being placed
  // and then rearranged.
  expect(screen.getByTestId('layout-mode-switcher')).toBeInTheDocument();
  expect(
    screen.getByText('Blank dashboard — ask the assistant to start building'),
  ).toBeInTheDocument();
});

test('the layout control survives the first block being added', () => {
  provider.addBuildingBlock(provider.getRoot().id, 0, { type: 'markdown' });

  render(<DashboardBuilderV2 />);

  expect(screen.getByTestId('layout-mode-switcher')).toBeInTheDocument();
});
