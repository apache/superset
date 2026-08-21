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
import { Form, type FormInstance } from '@superset-ui/core/components';
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

function renderColumnPicker(
  controlItemConfig: Record<string, unknown> = {},
  propsOverrides: Partial<ControlItemsProps> = {},
) {
  (getControlItems as jest.Mock).mockReturnValue([
    {
      name: 'myPluginColumn',
      config: {
        isColumnSelect: true,
        label: 'My Column',
        ...controlItemConfig,
      },
    },
  ]);
  const props = { ...createProps(), datasetId: 1, ...propsOverrides };
  const map = getControlItemsMap(props);
  const element = map.mainControlItems.myPluginColumn
    .element as React.ReactElement;
  // Field/Form.Item only applies `initialValue` when registered under a real
  // antd Form — without it, the value/onChange the control receives always
  // resolve to undefined regardless of `initialValue`.
  function Wrapper() {
    const [form] = Form.useForm();
    return <Form form={form}>{element}</Form>;
  }
  render(<Wrapper />);
  return props;
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

test('renders without throwing when label/description are multi-argument functions', () => {
  const props = createProps();
  (getControlItems as jest.Mock).mockReturnValue([
    {
      name: 'name_1',
      config: {
        renderTrigger: true,
        label: (state: unknown) => `label:${state}`,
        description: (state: unknown) => `description:${state}`,
      },
    },
  ]);
  const controlItemsMap = getControlItemsMap(props);
  expect(() => renderControlItems(controlItemsMap)).not.toThrow();
  expect(screen.getByRole('checkbox')).toBeInTheDocument();
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

test('plugin column-picker control (isColumnSelect) resets stale value not present in fetched columns', async () => {
  const fetchPromise = Promise.resolve({
    response: {} as Response,
    json: { result: { columns: [{ column_name: 'col_a' }] } },
  });
  mockCachedSupersetGet.mockReturnValue(fetchPromise);
  const props = renderColumnPicker(
    {},
    {
      filterToEdit: {
        ...filterMock,
        controlValues: { myPluginColumn: 'stale_col' },
      },
    },
  );
  expect(setNativeFilterFieldValues).not.toHaveBeenCalled();
  await act(async () => {
    await fetchPromise;
  });
  expect(setNativeFilterFieldValues).toHaveBeenCalledWith(
    props.form,
    props.filterId,
    { defaultDataMask: null },
  );
  expect(props.forceUpdate).toHaveBeenCalled();
  expect(props.formChanged).toHaveBeenCalled();
});

test('plugin column-picker control (isColumnSelect) does not reset value that still exists after fetch', async () => {
  const fetchPromise = Promise.resolve({
    response: {} as Response,
    json: {
      result: {
        columns: [{ column_name: 'col_a' }, { column_name: 'col_b' }],
      },
    },
  });
  mockCachedSupersetGet.mockReturnValue(fetchPromise);
  const props = renderColumnPicker(
    {},
    {
      filterToEdit: {
        ...filterMock,
        controlValues: { myPluginColumn: 'col_a' },
      },
    },
  );
  await act(async () => {
    await fetchPromise;
  });
  expect(setNativeFilterFieldValues).not.toHaveBeenCalled();
  expect(props.forceUpdate).not.toHaveBeenCalled();
  expect(props.formChanged).not.toHaveBeenCalled();
});

test('plugin column-picker control (isColumnSelect) resets value immediately when datasetId is cleared', async () => {
  const props = renderColumnPicker(
    {},
    {
      datasetId: undefined,
      filterToEdit: {
        ...filterMock,
        controlValues: { myPluginColumn: 'stale_col' },
      },
    },
  );
  expect(mockCachedSupersetGet).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(setNativeFilterFieldValues).toHaveBeenCalledWith(
      props.form,
      props.filterId,
      { defaultDataMask: null },
    ),
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

test('plugin column-picker control (isColumnSelect) populates options after a successful fetch, dropping blank column names', async () => {
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
  expect(
    await screen.findByRole('option', { name: 'col_a' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(1);
});

test('plugin column-picker control (isColumnSelect) falls back to no options when the fetch rejects', async () => {
  mockCachedSupersetGet.mockRejectedValue(new Error('boom'));
  renderColumnPicker();
  await waitFor(() => expect(mockCachedSupersetGet).toHaveBeenCalled());
  userEvent.click(screen.getByRole('combobox'));
  expect(screen.queryAllByRole('option')).toHaveLength(0);
});

test('plugin column-picker control (isColumnSelect) keeps existing value when fetch rejects', async () => {
  mockCachedSupersetGet.mockRejectedValue(new Error('boom'));
  const props = renderColumnPicker(
    {},
    {
      filterToEdit: {
        ...filterMock,
        controlValues: { myPluginColumn: 'stale_col' },
      },
    },
  );
  await waitFor(() => expect(mockCachedSupersetGet).toHaveBeenCalled());
  expect(setNativeFilterFieldValues).not.toHaveBeenCalled();
  expect(props.forceUpdate).not.toHaveBeenCalled();
  expect(props.formChanged).not.toHaveBeenCalled();
  expect(await screen.findByText('stale_col')).toBeInTheDocument();
});

test('plugin column-picker control (isColumnSelect) onChange resets defaultDataMask and notifies change', async () => {
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
  await waitFor(() =>
    expect(setNativeFilterFieldValues).toHaveBeenCalledWith(
      props.form,
      props.filterId,
      { defaultDataMask: null },
    ),
  );
  expect(props.forceUpdate).toHaveBeenCalled();
  expect(props.formChanged).toHaveBeenCalled();
});
