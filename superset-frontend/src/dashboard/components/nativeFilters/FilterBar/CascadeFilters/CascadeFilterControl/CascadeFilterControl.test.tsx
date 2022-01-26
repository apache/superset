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
import React from 'react';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { mockStore } from 'spec/fixtures/mockStore';
import { Provider } from 'react-redux';
import { nativeFiltersInfo } from 'src/dashboard/fixtures/mockNativeFilters';
import CascadeFilterControl, { CascadeFilterControlProps } from '.';

const createProps = (defaultsId = nativeFiltersInfo.filters.DefaultsID) => ({
  filter: {
    ...defaultsId,
    cascadeChildren: [
      {
        ...defaultsId,
        name: 'test child filter 1',
        cascadeChildren: [],
      },
      {
        ...defaultsId,
        name: 'test child filter 2',
        cascadeChildren: [
          {
            ...defaultsId,
            name: 'test child of a child filter',
            cascadeChildren: [],
          },
        ],
      },
    ],
  },
  onFilterSelectionChange: jest.fn(),
});

const setup = (props: CascadeFilterControlProps) => (
  <Provider store={mockStore}>
    <CascadeFilterControl {...props} />
  </Provider>
);

test('should render', () => {
  const { container } = render(setup(createProps()));
  expect(container).toBeInTheDocument();
});

test('should render the filter name', () => {
  render(setup(createProps()));
  expect(screen.getByText('test')).toBeInTheDocument();
});

test('should render the children filter names', () => {
  render(setup(createProps()));
  expect(screen.getByText('test child filter 1')).toBeInTheDocument();
  expect(screen.getByText('test child filter 2')).toBeInTheDocument();
});

test('should render the child of a child filter name', () => {
  render(setup(createProps()));
  expect(screen.getByText('test child of a child filter')).toBeInTheDocument();
});

test('should render tooltip if description is not empty', async () => {
  render(setup(createProps()));
  expect(screen.getByText('test')).toBeInTheDocument();
  const toolTip = screen.getByText('test')?.parentElement?.querySelector('i');
  expect(toolTip).not.toBe(null);
  fireEvent.mouseOver(toolTip as HTMLElement);
  expect(await screen.findByText('test description')).toBeInTheDocument();
});

test('should not render tooltip if description is empty', () => {
  render(
    setup(
      createProps({ ...nativeFiltersInfo.filters.DefaultsID, description: '' }),
    ),
  );
  const toolTip = screen.getByText('test')?.parentElement?.querySelector('i');
  expect(toolTip).toBe(null);
});
