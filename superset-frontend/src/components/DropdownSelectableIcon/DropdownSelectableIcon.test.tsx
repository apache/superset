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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import Icons from 'src/components/Icons';
import userEvent from '@testing-library/user-event';
import DropdownSelectableIcon, { DropDownSelectableProps } from '.';

const mockedProps = {
  menuItems: [
    {
      key: 'vertical',
      label: 'vertical',
    },
    {
      key: 'horizontal',
      label: 'horizontal',
    },
  ],
  selectedKeys: [],
  icon: <Icons.Gear name="gear" />,
};

const asyncRender = (props: DropDownSelectableProps) =>
  waitFor(() => render(<DropdownSelectableIcon {...props} />));

const openMenu = () => {
  userEvent.click(screen.getByRole('img', { name: 'gear' }));
};

test('should render', async () => {
  const { container } = await asyncRender(mockedProps);
  expect(container).toBeInTheDocument();
});

test('should render the icon', async () => {
  await asyncRender(mockedProps);
  expect(screen.getByRole('img', { name: 'gear' })).toBeInTheDocument();
});

test('should not render the info', async () => {
  await asyncRender(mockedProps);
  openMenu();
  expect(
    screen.queryByTestId('dropdown-selectable-info'),
  ).not.toBeInTheDocument();
});

test('should render the info', async () => {
  const infoProps = {
    ...mockedProps,
    info: 'Test',
  };
  await asyncRender(infoProps);
  openMenu();
  expect(screen.getByTestId('dropdown-selectable-info')).toBeInTheDocument();
  expect(screen.getByText('Test')).toBeInTheDocument();
});

test('should render the menu items', async () => {
  await asyncRender(mockedProps);
  openMenu();
  expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  expect(screen.getByText('vertical')).toBeInTheDocument();
  expect(screen.getByText('horizontal')).toBeInTheDocument();
});

test('should not render any selected menu item', async () => {
  await asyncRender(mockedProps);
  openMenu();
  expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  expect(screen.queryByRole('img', { name: 'check' })).not.toBeInTheDocument();
});

test('should render the selected menu items', async () => {
  const selectedProps = {
    ...mockedProps,
    selectedKeys: ['vertical'],
  };
  await asyncRender(selectedProps);
  openMenu();
  expect(screen.getByRole('img', { name: 'check' })).toBeInTheDocument();
});
