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
  act,
  fireEvent,
  render,
  screen,
  within,
  cleanup,
} from 'spec/helpers/testing-library';
import { store } from 'src/views/store';
import { isFeatureEnabled } from '@superset-ui/core';
import { FacePile } from '.';
import { getRandomColor } from './utils';

// Mock the feature flag
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

const users = [...new Array(10)].map((_, i) => ({
  first_name: 'user',
  last_name: `${i}`,
  id: i,
}));

beforeEach(() => {
  jest.useFakeTimers();
  // Default to Slack avatars disabled
  mockIsFeatureEnabled.mockImplementation(() => false);
});

afterEach(() => {
  jest.useRealTimers();
  mockIsFeatureEnabled.mockReset();
  cleanup();
});

describe('FacePile', () => {
  it('renders empty state with no users', () => {
    const { container } = render(<FacePile users={[]} />, { store });

    expect(container.querySelector('.ant-avatar-group')).toBeInTheDocument();
    expect(container.querySelectorAll('.ant-avatar')).toHaveLength(0);
  });

  it('renders single user without truncation', () => {
    const { container } = render(<FacePile users={users.slice(0, 1)} />, {
      store,
    });

    const avatars = container.querySelectorAll('.ant-avatar');
    expect(avatars).toHaveLength(1);
    expect(within(container).getByText('U0')).toBeInTheDocument();
    expect(within(container).queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('renders multiple users no truncation', () => {
    const { container } = render(<FacePile users={users.slice(0, 4)} />, {
      store,
    });

    const avatars = container.querySelectorAll('.ant-avatar');
    expect(avatars).toHaveLength(4);
    expect(within(container).getByText('U0')).toBeInTheDocument();
    expect(within(container).getByText('U1')).toBeInTheDocument();
    expect(within(container).getByText('U2')).toBeInTheDocument();
    expect(within(container).getByText('U3')).toBeInTheDocument();
    expect(within(container).queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('renders multiple users with truncation', () => {
    const { container } = render(<FacePile users={users} />, { store });

    // Should show 4 avatars + 1 overflow indicator = 5 total elements
    const avatars = container.querySelectorAll('.ant-avatar');
    expect(avatars).toHaveLength(5);

    // Should show first 4 users
    expect(within(container).getByText('U0')).toBeInTheDocument();
    expect(within(container).getByText('U1')).toBeInTheDocument();
    expect(within(container).getByText('U2')).toBeInTheDocument();
    expect(within(container).getByText('U3')).toBeInTheDocument();

    // Should show overflow count (+6 because 10 total - 4 shown)
    expect(within(container).getByText('+6')).toBeInTheDocument();
  });

  it('displays user tooltip on hover', () => {
    const { container } = render(<FacePile users={users.slice(0, 2)} />, {
      store,
    });

    const firstAvatar = within(container).getByText('U0');
    fireEvent.mouseEnter(firstAvatar);
    act(() => jest.runAllTimers());

    expect(screen.getByRole('tooltip')).toHaveTextContent('user 0');
  });

  it('displays avatar images when Slack avatars are enabled', () => {
    // Enable Slack avatars feature flag
    mockIsFeatureEnabled.mockImplementation(
      feature => feature === 'SLACK_ENABLE_AVATARS',
    );

    const { container: testContainer } = render(
      <FacePile users={users.slice(0, 2)} />,
      {
        store,
      },
    );

    const avatars = testContainer.querySelectorAll('.ant-avatar');
    expect(avatars).toHaveLength(2);

    // Should have img elements with correct src attributes
    const imgs = testContainer.querySelectorAll('.ant-avatar img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('src', '/api/v1/user/0/avatar.png');
    expect(imgs[1]).toHaveAttribute('src', '/api/v1/user/1/avatar.png');
  });
});

describe('utils', () => {
  describe('getRandomColor', () => {
    const colors = ['color1', 'color2', 'color3'];

    it('produces the same color for the same input values', () => {
      const name = 'foo';
      expect(getRandomColor(name, colors)).toEqual(
        getRandomColor(name, colors),
      );
    });

    it('produces a different color for different input values', () => {
      expect(getRandomColor('foo', colors)).not.toEqual(
        getRandomColor('bar', colors),
      );
    });

    it('handles non-ascii input values', () => {
      expect(getRandomColor('泰', colors)).toMatchInlineSnapshot(`"color1"`);
      expect(getRandomColor('مُحَمَّد‎', colors)).toMatchInlineSnapshot(
        `"color2"`,
      );
    });
  });
});
