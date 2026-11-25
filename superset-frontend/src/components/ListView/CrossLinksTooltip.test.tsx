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
import CrossLinksTooltip, { CrossLinksTooltipProps } from './CrossLinksTooltip';

const mockedProps = {
  crossLinks: [
    {
      to: 'somewhere/1',
      title: 'Test dashboard',
    },
    {
      to: 'somewhere/2',
      title: 'Test dashboard 2',
    },
    {
      to: 'somewhere/3',
      title: 'Test dashboard 3',
    },
    {
      to: 'somewhere/4',
      title: 'Test dashboard 4',
    },
  ],
  moreItems: 0,
  show: true,
};

function setup(overrideProps: CrossLinksTooltipProps | {} = {}) {
  return render(
    <CrossLinksTooltip {...mockedProps} {...overrideProps}>
      Hover me
    </CrossLinksTooltip>,
    {
      useRouter: true,
    },
  );
}

test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should render multiple links', async () => {
  setup();
  await userEvent.hover(screen.getByText('Hover me'));

  await waitFor(() => {
    expect(screen.getByText('Test dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test dashboard 2')).toBeInTheDocument();
    expect(screen.getByText('Test dashboard 3')).toBeInTheDocument();
    expect(screen.getByText('Test dashboard 4')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });
});

test('should not render the "+ {x} more"', async () => {
  setup();
  await userEvent.hover(screen.getByText('Hover me'));
  expect(screen.queryByTestId('plus-more')).not.toBeInTheDocument();
});

test('should render the "+ {x} more"', async () => {
  setup({
    moreItems: 3,
  });
  await userEvent.hover(screen.getByText('Hover me'));
  expect(await screen.findByTestId('plus-more')).toBeInTheDocument();
  expect(await screen.findByText('+ 3 more')).toBeInTheDocument();
});

test('renders archived tooltip entries as labelled blocks alongside live links', async () => {
  setup({
    crossLinks: [
      { to: '/dashboard/1', title: 'Live dashboard' },
      { to: '/dashboard/2', title: 'Archived dashboard', archived: true },
      { to: '/dashboard/3', title: 'Other archived dashboard', archived: true },
    ],
  });
  await userEvent.hover(screen.getByText('Hover me'));

  const archived = await screen.findByText('Archived dashboard');
  expect(archived.tagName).toBe('DIV');
  expect(archived.closest('a')).toBeNull();
  expect(screen.getByText('Other archived dashboard').tagName).toBe('DIV');
  expect(screen.getAllByLabelText('Archived')).toHaveLength(2);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Live dashboard' })).toHaveAttribute(
    'href',
    '/dashboard/1',
  );
});

test('archived tooltip label inherits the tooltip text color', async () => {
  setup({
    crossLinks: [{ to: '/dashboard/2', title: 'Archived', archived: true }],
  });
  await userEvent.hover(screen.getByText('Hover me'));

  const label = await screen.findByLabelText('Archived');
  // The tooltip overlay is dark in the light theme; secondary text color
  // (dark grey) would be unreadable there.
  expect(getComputedStyle(label).color).toBe('inherit');
});
