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
import CrossLinks, { CrossLinksProps } from './CrossLinks';

const mockedProps = {
  crossLinks: [
    {
      id: 1,
      title: 'Test dashboard',
    },
    {
      id: 2,
      title: 'Test dashboard 2',
    },
    {
      id: 3,
      title: 'Test dashboard 3',
    },
    {
      id: 4,
      title: 'Test dashboard 4',
    },
  ],
};

function setup(overrideProps: CrossLinksProps | {} = {}) {
  return render(<CrossLinks {...mockedProps} {...overrideProps} />, {
    useRouter: true,
  });
}

test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should not render links', () => {
  setup({
    crossLinks: [],
  });
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('should render the link with just one item', () => {
  setup({
    crossLinks: [
      {
        id: 1,
        title: 'Test dashboard',
      },
    ],
  });
  expect(screen.getByText('Test dashboard')).toBeInTheDocument();
  // default `linkPrefix` is now `/dashboard/` (post-route_base);
  // legacy `/superset/dashboard/...` was the pre-collapse route.
  expect(screen.getByRole('link')).toHaveAttribute('href', `/dashboard/1`);
});

test('should render a custom prefix link', () => {
  setup({
    crossLinks: [
      {
        id: 1,
        title: 'Test dashboard',
      },
    ],
    linkPrefix: '/custom/dashboard/',
  });
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    `/custom/dashboard/1`,
  );
});

test('should render multiple links', () => {
  setup();
  expect(screen.getAllByRole('link')).toHaveLength(4);
});

test('mixed archived and live items each occupy one measured element', () => {
  setup({
    crossLinks: [
      { id: 1, title: 'Live dashboard' },
      { id: 2, title: 'Archived dashboard', archived: true },
      { id: 3, title: 'Another live dashboard', archived: false },
    ],
  });

  const items = screen.getByTestId('crosslinks');
  expect(items.childNodes).toHaveLength(3);
  expect(
    Array.from(items.childNodes).every(
      node => node.nodeType === Node.ELEMENT_NODE,
    ),
  ).toBe(true);
  expect(items.children[1]).toHaveTextContent(', Archived dashboard(archived)');
  expect(screen.getByText(/Archived dashboard/).closest('a')).toBeNull();
  expect(screen.getByLabelText('Archived')).toHaveTextContent('(archived)');
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'Live dashboard' })).toHaveAttribute(
    'href',
    '/dashboard/1',
  );
});

test('passes archived state to the overflow tooltip', async () => {
  const scrollWidth = jest
    .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
    .mockReturnValue(100);
  const clientWidth = jest
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockReturnValue(0);
  try {
    setup({
      crossLinks: [
        { id: 1, title: 'Live dashboard' },
        { id: 2, title: 'Archived dashboard', archived: true },
      ],
    });
    await userEvent.hover(screen.getByTestId('count-crosslinks'));
    const tooltip = await screen.findByRole('tooltip');
    expect(
      within(tooltip).getByText('Archived dashboard').closest('a'),
    ).toBeNull();
    expect(within(tooltip).getByLabelText('Archived')).toBeInTheDocument();
    expect(within(tooltip).getAllByRole('link')).toHaveLength(1);
  } finally {
    scrollWidth.mockRestore();
    clientWidth.mockRestore();
  }
});
