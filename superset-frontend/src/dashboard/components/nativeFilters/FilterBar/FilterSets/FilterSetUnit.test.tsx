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
import { render, screen } from 'spec/helpers/testing-library';
import { mockStore } from 'spec/fixtures/mockStore';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';
import FilterSetUnit, { FilterSetUnitProps } from './FilterSetUnit';

const createProps = () => ({
  editMode: true,
  setFilterSetName: jest.fn(),
  onDelete: jest.fn(),
  onEdit: jest.fn(),
  onRebuild: jest.fn(),
});

function openDropdown() {
  const dropdownIcon = screen.getAllByRole('img', { name: '' })[0];
  userEvent.click(dropdownIcon);
}

const setup = (props: FilterSetUnitProps) => (
  <Provider store={mockStore}>
    <FilterSetUnit {...props} />
  </Provider>
);

test('should render', () => {
  const mockedProps = createProps();
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the edit button', () => {
  const mockedProps = createProps();
  const editModeOffProps = {
    ...mockedProps,
    editMode: false,
  };
  render(setup(editModeOffProps));
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
});

test('should render the menu', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  openDropdown();
  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  expect(screen.getByText('Edit')).toBeInTheDocument();
  expect(screen.getByText('Rebuild')).toBeInTheDocument();
  expect(screen.getByText('Delete')).toBeInTheDocument();
});

test('should edit', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  openDropdown();
  const editBtn = screen.getByText('Edit');
  expect(mockedProps.onEdit).not.toHaveBeenCalled();
  userEvent.click(editBtn);
  expect(mockedProps.onEdit).toHaveBeenCalled();
});

test('should delete', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  openDropdown();
  const deleteBtn = screen.getByText('Delete');
  expect(mockedProps.onDelete).not.toHaveBeenCalled();
  userEvent.click(deleteBtn);
  expect(mockedProps.onDelete).toHaveBeenCalled();
});

test('should rebuild', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  openDropdown();
  const rebuildBtn = screen.getByText('Rebuild');
  expect(mockedProps.onRebuild).not.toHaveBeenCalled();
  userEvent.click(rebuildBtn);
  expect(mockedProps.onRebuild).toHaveBeenCalled();
});
