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
import { Filter, NativeFilterType } from '@superset-ui/core';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import type { FormInstance } from '@superset-ui/core/components';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import getControlItemsMap, { ControlItemsProps } from './getControlItemsMap';
import {
  getControlItems,
  setNativeFilterFieldValues,
  doesColumnMatchFilterType,
} from './utils';

jest.mock('./utils', () => ({
  getControlItems: jest.fn(),
  setNativeFilterFieldValues: jest.fn(),
  doesColumnMatchFilterType: jest.fn(),
}));

jest.mock('src/utils/cachedSupersetGet');
const mockCachedSupersetGet = cachedSupersetGet as jest.MockedFunction<
  typeof cachedSupersetGet
>;

type MockColumn = { name: string; filterable: boolean };

// Mock ColumnSelect to test filterValues logic and expose onChange
jest.mock('./ColumnSelect', () => ({
  ColumnSelect: ({
    filterValues,
    onChange,
  }: {
    filterValues: (column: MockColumn) => boolean;
    onChange?: (value: string) => void;
  }) => {
    const columns = [
      { name: 'col1', filterable: true },
      { name: 'col2', filterable: false },
      { name: 'col3', filterable: true },
    ];
    return (
      <>
        {columns.filter(filterValues).map(column => (
          <div key={column.name} onClick={() => onChange?.(column.name)}>
            {column.name}
          </div>
        ))}
      </>
    );
  },
}));

const formMock: FormInstance = {
  focusField: () => {},
  getFieldWarning: () => [],
  setFieldValue: () => {},
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

const createProps = (): ControlItemsProps => ({
  expanded: false,
  datasetId: 1,
  disabled: false,
  forceUpdate: jest.fn(),
  form: formMock,
  filterId: 'filterId',
  filterToEdit: filterMock,
  filterType: 'filterType',
  formChanged: jest.fn(),
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
  mockCachedSupersetGet.mockReset();
});

function renderControlItems(
  controlItemsMap: ReturnType<typeof getControlItemsMap>,
) {
  return render(
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
  expect(props.forceUpdate).not.toHaveBeenCalled();
  expect(setNativeFilterFieldValues).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('checkbox'));
  expect(setNativeFilterFieldValues).toHaveBeenCalled();
  expect(props.forceUpdate).toHaveBeenCalled();
});

test('Clicking on checkbox when resetConfig:false', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue([
    { name: 'name_1', config: { renderTrigger: true, resetConfig: false } },
  ]);
  const controlItemsMap = getControlItemsMap(props);
  renderControlItems(controlItemsMap);
  expect(props.forceUpdate).not.toHaveBeenCalled();
  expect(setNativeFilterFieldValues).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('checkbox'));
  expect(props.forceUpdate).toHaveBeenCalled();
  expect(setNativeFilterFieldValues).not.toHaveBeenCalled();
});

test('Clicking on checkbox calls setNativeFilterFieldValues with requiredFirst when config.requiredFirst is true', () => {
  const props = {
    ...createProps(),
    formFilter: { requiredFirst: { name_1: false } },
  };
  (getControlItems as jest.Mock).mockReturnValue([
    {
      name: 'name_1',
      config: { renderTrigger: true, requiredFirst: true, resetConfig: false },
    },
  ]);
  // @ts-expect-error: bypass incomplete formFilter type for test
  const controlItemsMap = getControlItemsMap(props);
  renderControlItems(controlItemsMap);
  userEvent.click(screen.getByRole('checkbox'));
  expect(setNativeFilterFieldValues).toHaveBeenCalledWith(
    props.form,
    props.filterId,
    {
      requiredFirst: {
        name_1: expect.objectContaining({
          target: expect.objectContaining({ checked: true }),
        }),
      },
    },
  );
});

test('groupby ColumnSelect onChange resets defaultDataMask and notifies change', () => {
  (doesColumnMatchFilterType as jest.Mock).mockReturnValue(true);
  (getControlItems as jest.Mock).mockReturnValue([
    { name: 'groupby', config: { multiple: false, required: false } },
  ]);
  const props = {
    ...createProps(),
    formFilter: { filterType: 'filterType' },
  };
  // @ts-expect-error: bypass incomplete formFilter type for test
  const element = getControlItemsMap(props).mainControlItems.groupby
    .element as React.ReactElement;
  render(element);
  expect(props.forceUpdate).not.toHaveBeenCalled();
  expect(props.formChanged).not.toHaveBeenCalled();
  userEvent.click(screen.getByText('col1'));
  expect(setNativeFilterFieldValues).toHaveBeenCalledWith(
    props.form,
    props.filterId,
    { defaultDataMask: null },
  );
  expect(props.forceUpdate).toHaveBeenCalled();
  expect(props.formChanged).toHaveBeenCalled();
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ColumnSelect filterValues behavior', () => {
  beforeEach(() => {
    (getControlItems as jest.Mock).mockReturnValue([
      {
        name: 'groupby',
        config: { label: 'Column', multiple: false, required: false },
      },
    ]);
  });

  test('only renders filterable columns when doesColumnMatchFilterType returns true', () => {
    (doesColumnMatchFilterType as jest.Mock).mockReturnValue(true);
    const props = {
      ...createProps(),
      formFilter: { filterType: 'filterType' },
    };
    // @ts-expect-error: bypass incomplete formFilter type for test
    const element = getControlItemsMap(props).mainControlItems.groupby
      .element as React.ReactElement;
    render(element);
    expect(screen.getByText('col1')).toBeInTheDocument();
    expect(screen.getByText('col3')).toBeInTheDocument();
    expect(screen.queryByText('col2')).not.toBeInTheDocument();
  });

  test('renders no columns when doesColumnMatchFilterType returns false', () => {
    (doesColumnMatchFilterType as jest.Mock).mockReturnValue(false);
    const props = {
      ...createProps(),
      formFilter: { filterType: 'filterType' },
    };
    // @ts-expect-error: bypass incomplete formFilter type for test
    const element = getControlItemsMap(props).mainControlItems.groupby
      .element as React.ReactElement;
    render(element);
    expect(screen.queryByText('col1')).not.toBeInTheDocument();
    expect(screen.queryByText('col3')).not.toBeInTheDocument();
    expect(screen.queryByText('col2')).not.toBeInTheDocument();
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('plugin column-picker control (isColumnSelect)', () => {
  function renderColumnPicker(
    controlItemConfig: Record<string, unknown> = {},
    propsOverrides: Partial<ControlItemsProps> = {},
  ) {
    (getControlItems as jest.Mock).mockReturnValue([
      {
        name: 'myPluginColumn',
        config: { isColumnSelect: true, label: 'My Column', ...controlItemConfig },
      },
    ]);
    const props = { ...createProps(), datasetId: 1, ...propsOverrides };
    const map = getControlItemsMap(props);
    render(map.mainControlItems.myPluginColumn.element as React.ReactElement);
    return props;
  }

  test('populates options after a successful fetch, dropping blank column names', async () => {
    const fetchPromise = Promise.resolve({
      response: {} as Response,
      json: {
        result: {
          columns: [
            { column_name: 'col_a' },
            { column_name: '' },
            { column_name: null },
          ],
        },
      },
    });
    mockCachedSupersetGet.mockReturnValue(fetchPromise);
    renderColumnPicker();
    expect(mockCachedSupersetGet).toHaveBeenCalledWith({
      endpoint: expect.stringContaining('/api/v1/dataset/1?q='),
    });
    await act(async () => {
      await fetchPromise;
    });
    userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'col_a' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  test('falls back to no options when the fetch rejects', async () => {
    mockCachedSupersetGet.mockRejectedValue(new Error('boom'));
    renderColumnPicker();
    await waitFor(() => expect(mockCachedSupersetGet).toHaveBeenCalled());
    userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  test('onChange resets defaultDataMask and notifies change', async () => {
    const fetchPromise = Promise.resolve({
      response: {} as Response,
      json: { result: { columns: [{ column_name: 'col_a' }] } },
    });
    mockCachedSupersetGet.mockReturnValue(fetchPromise);
    const props = renderColumnPicker();
    await act(async () => {
      await fetchPromise;
    });
    userEvent.click(screen.getByRole('combobox'));
    userEvent.click(await screen.findByRole('option', { name: 'col_a' }));
    expect(setNativeFilterFieldValues).toHaveBeenCalledWith(
      props.form,
      props.filterId,
      { defaultDataMask: null },
    );
    expect(props.forceUpdate).toHaveBeenCalled();
    expect(props.formChanged).toHaveBeenCalled();
  });
});
