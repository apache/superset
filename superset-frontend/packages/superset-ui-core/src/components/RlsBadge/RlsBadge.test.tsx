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
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import { RlsBadge, type RlsBadgeProps } from '.';

const mockFilters = [
  { id: 1, name: 'Finance filter', filter_type: 'Regular', group_key: 'dept' },
  { id: 2, name: 'Base restriction', filter_type: 'Base', group_key: null },
];

const asyncRender = (props: RlsBadgeProps) =>
  waitFor(() => render(<RlsBadge {...props} />));

test('renders nothing when rlsFilters is empty', async () => {
  const { container } = await asyncRender({ rlsFilters: [] });
  expect(container.firstChild).toBeNull();
});

test('renders a lock icon when filters exist', async () => {
  await asyncRender({ rlsFilters: mockFilters });
  expect(screen.getByRole('img')).toBeInTheDocument();
});

test('renders a tooltip with filter details when hovered', async () => {
  await asyncRender({ rlsFilters: mockFilters });
  await userEvent.hover(screen.getByRole('img'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Row-Level Security');
  expect(tooltip).toHaveTextContent('Finance filter');
  expect(tooltip).toHaveTextContent('Base restriction');
});

test('shows filter type in tooltip', async () => {
  await asyncRender({ rlsFilters: mockFilters });
  await userEvent.hover(screen.getByRole('img'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Regular');
  expect(tooltip).toHaveTextContent('Base');
});

test('shows group key in tooltip when present', async () => {
  await asyncRender({ rlsFilters: mockFilters });
  await userEvent.hover(screen.getByRole('img'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('[dept]');
});
