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
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import SubMenu, { ButtonProps } from './SubMenu';

const mockedProps = {
  name: 'Title',
  tabs: [
    {
      name: 'Page1',
      label: 'Page1',
      url: '/page1',
      usesRouter: true,
    },
    {
      name: 'Page2',
      label: 'Page2',
      url: '/page2',
      usesRouter: true,
    },
    {
      name: 'Page3',
      label: 'Page3',
      url: '/page3',
      usesRouter: false,
    },
  ],
  dropDownLinks: [
    {
      label: 'test an upload',
      childs: [
        {
          label: 'Upload Test',
          name: 'Upload Test',
          url: '/test/form',
          perm: true,
        },
      ],
    },
  ],
};

test('should render', async () => {
  const { container } = render(<SubMenu {...mockedProps} />);
  expect(await screen.findByText(/title/i)).toBeInTheDocument();
  expect(container).toBeInTheDocument();
});

test('should render the navigation', async () => {
  render(<SubMenu {...mockedProps} />);
  expect(await screen.findByRole('navigation')).toBeInTheDocument();
});

test('should render the brand', async () => {
  render(<SubMenu {...mockedProps} />);
  expect(await screen.findByText('Title')).toBeInTheDocument();
});

test('should render the right number of tabs', async () => {
  render(<SubMenu {...mockedProps} />);
  expect(await screen.findAllByRole('tab')).toHaveLength(3);
});

test('should render all the tabs links', async () => {
  const { tabs } = mockedProps;
  render(<SubMenu {...mockedProps} />);
  expect(await screen.findAllByRole('tab')).toHaveLength(3);
  tabs.forEach(tab => {
    const tabItem = screen.getByText(tab.label);
    expect(tabItem).toHaveAttribute('href', tab.url);
  });
});

test('should render dropdownlinks', async () => {
  render(<SubMenu {...mockedProps} />);
  userEvent.hover(screen.getByText('test an upload'));
  const label = await screen.findByText('test an upload');
  expect(label).toBeInTheDocument();
});

test('should render the buttons', async () => {
  const mockFunc = jest.fn();
  const buttons = [
    {
      name: 'test_button',
      onClick: mockFunc,
      buttonStyle: 'primary' as ButtonProps['buttonStyle'],
    },
    {
      name: 'danger_button',
      onClick: mockFunc,
      buttonStyle: 'danger' as ButtonProps['buttonStyle'],
    },
  ];
  const buttonsProps = {
    ...mockedProps,
    buttons,
  };
  render(<SubMenu {...buttonsProps} />);
  const testButton = screen.getByText(buttons[0].name);
  expect(await screen.findAllByRole('button')).toHaveLength(3);
  userEvent.click(testButton);
  expect(mockFunc).toHaveBeenCalled();
});
