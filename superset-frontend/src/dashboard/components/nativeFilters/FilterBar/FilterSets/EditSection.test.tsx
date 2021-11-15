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
import userEvent from '@testing-library/user-event';
import { mockStore } from 'spec/fixtures/mockStore';
import { Provider } from 'react-redux';
import EditSection, { EditSectionProps } from './EditSection';

const createProps = () => ({
  filterSetId: 1,
  dataMaskSelected: {
    DefaultsID: {
      filterState: {
        value: 'value',
      },
    },
  },
  onCancel: jest.fn(),
  disabled: false,
});

const setup = (props: EditSectionProps) => (
  <Provider store={mockStore}>
    <EditSection {...props} />
  </Provider>
);

test('should render', () => {
  const mockedProps = createProps();
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the title', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByText('Editing filter set:')).toBeInTheDocument();
});

test('should render the set name', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByText('Set name')).toBeInTheDocument();
});

test('should render a textbox', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByRole('textbox')).toBeInTheDocument();
});

test('should change the set name', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  const textbox = screen.getByRole('textbox');
  userEvent.clear(textbox);
  userEvent.type(textbox, 'New name');
  expect(textbox).toHaveValue('New name');
});

test('should render the enter icon', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByRole('img', { name: 'enter' })).toBeInTheDocument();
});

test('should render the Cancel button', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByText('Cancel')).toBeInTheDocument();
});

test('should cancel', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  const cancelBtn = screen.getByText('Cancel');
  expect(mockedProps.onCancel).not.toHaveBeenCalled();
  userEvent.click(cancelBtn);
  expect(mockedProps.onCancel).toHaveBeenCalled();
});

test('should render the Save button', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByText('Save')).toBeInTheDocument();
});

test('should render the Save button as disabled', () => {
  const mockedProps = createProps();
  const saveDisabledProps = {
    ...mockedProps,
    disabled: true,
  };
  render(setup(saveDisabledProps));
  expect(screen.getByText('Save').parentElement).toBeDisabled();
});
