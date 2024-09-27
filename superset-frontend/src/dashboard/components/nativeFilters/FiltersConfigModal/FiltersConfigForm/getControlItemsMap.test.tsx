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
import { Filter, NativeFilterType } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import { FormInstance } from 'src/components';
import getControlItemsMap, { ControlItemsProps } from './getControlItemsMap';
import { getControlItems, setNativeFilterFieldValues } from './utils';

jest.mock('./utils', () => ({
  getControlItems: jest.fn(),
  setNativeFilterFieldValues: jest.fn(),
}));

const formMock: FormInstance = {
  __INTERNAL__: { itemRef: () => () => {} },
  scrollToField: () => {},
  getFieldInstance: () => {},
  getFieldValue: () => {},
  getFieldsValue: () => {},
  getFieldError: () => [],
  getFieldsError: () => [],
  isFieldsTouched: () => false,
  isFieldTouched: () => false,
  isFieldValidating: () => false,
  isFieldsValidating: () => false,
  resetFields: () => {},
  setFields: () => {},
  setFieldsValue: () => {},
  validateFields: () => Promise.resolve(),
  submit: () => {},
};

const filterMock: Filter = {
  cascadeParentIds: [],
  defaultDataMask: {},
  id: 'mock',
  name: 'mock',
  scope: {
    rootPath: [],
    excluded: [],
  },
  filterType: '',
  targets: [{}],
  controlValues: {},
  type: NativeFilterType.NativeFilter,
  description: '',
};

const createProps: () => ControlItemsProps = () => ({
  expanded: false,
  datasetId: 1,
  disabled: false,
  forceUpdate: jest.fn(),
  form: formMock,
  filterId: 'filterId',
  filterToEdit: filterMock,
  filterType: 'filterType',
});

const createControlItems = () => [
  null,
  false,
  {},
  { name: 'name_1', config: { renderTrigger: true, resetConfig: true } },
  { name: 'groupby', config: { multiple: true, required: false } },
];

beforeEach(() => {
  jest.clearAllMocks();
});

function renderControlItems(
  controlItemsMap: ReturnType<typeof getControlItemsMap>,
) {
  return render(
    // @ts-ignore
    <>
      {Object.values(controlItemsMap.controlItems).map(value => value.element)}
    </>,
  );
}

test('Should render null when has no "formFilter"', () => {
  const props = createProps();
  const controlItemsMap = getControlItemsMap(props);
  const { container } = renderControlItems(controlItemsMap);
  expect(container.children).toHaveLength(0);
});

test('Should render null when has no "formFilter.filterType" is falsy value', () => {
  const props = createProps();
  const controlItemsMap = getControlItemsMap({
    ...props,
    filterType: 'filterType',
  });
  const { container } = renderControlItems(controlItemsMap);
  expect(container.children).toHaveLength(0);
});

test('Should render null empty when "getControlItems" return []', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue([]);
  const controlItemsMap = getControlItemsMap(props);
  const { container } = renderControlItems(controlItemsMap);
  expect(container.children).toHaveLength(0);
});

test('Should render null empty when "getControlItems" return enableSingleValue', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue([
    { name: 'enableSingleValue', config: { renderTrigger: true } },
  ]);
  const controlItemsMap = getControlItemsMap(props);
  const { container } = renderControlItems(controlItemsMap);
  expect(container.children).toHaveLength(0);
});

test('Should render null empty when "controlItems" are falsy', () => {
  const props = createProps();
  const controlItems = [null, false, {}, { config: { renderTrigger: false } }];
  (getControlItems as jest.Mock).mockReturnValue(controlItems);
  const controlItemsMap = getControlItemsMap(props);
  const { container } = renderControlItems(controlItemsMap);
  expect(container.children).toHaveLength(0);
});

test('Should render ControlItems', () => {
  const props = createProps();

  const controlItems = [
    ...createControlItems(),
    { name: 'name_2', config: { renderTrigger: true } },
  ];
  (getControlItems as jest.Mock).mockReturnValue(controlItems);
  const controlItemsMap = getControlItemsMap(props);
  renderControlItems(controlItemsMap);
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
});

test('Clicking on checkbox', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue(createControlItems());
  const controlItemsMap = getControlItemsMap(props);
  renderControlItems(controlItemsMap);
  expect(props.forceUpdate).not.toBeCalled();
  expect(setNativeFilterFieldValues).not.toBeCalled();
  userEvent.click(screen.getByRole('checkbox'));
  expect(setNativeFilterFieldValues).toBeCalled();
  expect(props.forceUpdate).toBeCalled();
});

test('Clicking on checkbox when resetConfig:false', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue([
    { name: 'name_1', config: { renderTrigger: true, resetConfig: false } },
  ]);
  const controlItemsMap = getControlItemsMap(props);
  renderControlItems(controlItemsMap);
  expect(props.forceUpdate).not.toBeCalled();
  expect(setNativeFilterFieldValues).not.toBeCalled();
  userEvent.click(screen.getByRole('checkbox'));
  expect(props.forceUpdate).toBeCalled();
  expect(setNativeFilterFieldValues).not.toBeCalled();
});
