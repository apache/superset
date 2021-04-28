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
import { getControlItems, setNativeFilterFieldValues } from './utils';

import ControlItems from './ControlItems';

jest.mock('./utils', () => ({
  getControlItems: jest.fn(),
  setNativeFilterFieldValues: jest.fn(),
}));

const createProps = () => ({
  forceUpdate: jest.fn(),
  form: 'form',
  filterId: 'filterId',
  filterToEdit: '',
  formFilter: {
    filterType: 'filterType',
  },
});

const createControlItems = () => [
  null,
  false,
  {},
  { name: 'name_1', config: { renderTrigger: true, resetConfig: true } },
];

beforeEach(() => {
  jest.clearAllMocks();
});

test('Should render null when has no "formFilter"', () => {
  const defaultProps = createProps();
  const props = {
    forceUpdate: defaultProps.forceUpdate,
    form: defaultProps.form,
    filterId: defaultProps.filterId,
  };
  const { container } = render(<ControlItems {...(props as any)} />);
  expect(container.children).toHaveLength(0);
});

test('Should render null when has no "formFilter.filterType" is falsy value', () => {
  const defaultProps = createProps();
  const props = {
    forceUpdate: defaultProps.forceUpdate,
    form: defaultProps.form,
    filterId: defaultProps.filterId,
    formFilter: { name: 'name', filterType: 'filterType' },
  };
  const { container } = render(<ControlItems {...(props as any)} />);
  expect(container.children).toHaveLength(0);
});

test('Should render null empty when "getControlItems" return []', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue([]);
  const { container } = render(<ControlItems {...(props as any)} />);
  expect(container.children).toHaveLength(0);
});

test('Should render null empty when "controlItems" are falsy', () => {
  const props = createProps();
  const controlItems = [null, false, {}, { config: { renderTrigger: false } }];
  (getControlItems as jest.Mock).mockReturnValue(controlItems);

  const { container } = render(<ControlItems {...(props as any)} />);
  expect(container.children).toHaveLength(0);
});

test('Should render render ControlItems', () => {
  const props = createProps();

  const controlItems = [
    ...createControlItems(),
    { name: 'name_2', config: { renderTrigger: true } },
  ];
  (getControlItems as jest.Mock).mockReturnValue(controlItems);

  render(<ControlItems {...(props as any)} />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
});

test('Clickin on checkbox', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue(createControlItems());
  render(<ControlItems {...(props as any)} />);

  expect(props.forceUpdate).not.toBeCalled();
  expect(setNativeFilterFieldValues).not.toBeCalled();
  userEvent.click(screen.getByRole('checkbox'));
  expect(setNativeFilterFieldValues).toBeCalled();
  expect(props.forceUpdate).toBeCalled();
});

test('Clickin on checkbox when resetConfig:flase', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue([
    { name: 'name_1', config: { renderTrigger: true, resetConfig: false } },
  ]);
  render(<ControlItems {...(props as any)} />);

  expect(props.forceUpdate).not.toBeCalled();
  expect(setNativeFilterFieldValues).not.toBeCalled();
  userEvent.click(screen.getByRole('checkbox'));
  expect(props.forceUpdate).toBeCalled();
  expect(setNativeFilterFieldValues).not.toBeCalled();
});
