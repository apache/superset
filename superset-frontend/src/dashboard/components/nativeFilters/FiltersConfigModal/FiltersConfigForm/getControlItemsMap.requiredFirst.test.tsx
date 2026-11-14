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
import { Form, type FormInstance } from '@superset-ui/core/components';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { transformFilterForSave } from '../transformers/filterTransformer';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import getControlItemsMap from './getControlItemsMap';
import { getControlItems } from './utils';

// Keep the real form helpers; only stub the control panel lookup.
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  getControlItems: jest.fn(),
}));

const FILTER_ID = 'NATIVE_FILTER-rf';

// The config form used to store the checkbox change event as `requiredFirst`
// (#46161). JSON round-tripping leaves this shape behind.
const storedCheckboxEvent = (checked: boolean) => ({
  nativeEvent: { isTrusted: true },
  target: { checked, prefixCls: 'ant-checkbox', type: 'checkbox' },
});

const savedFilter = (
  requiredFirst: unknown,
  defaultToFirstItem: boolean,
): Filter =>
  ({
    id: FILTER_ID,
    name: 'Region',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    targets: [{ datasetId: 42, column: { name: 'region' } }],
    defaultDataMask: { filterState: {}, extraFormData: {} },
    cascadeParentIds: [],
    controlValues: { defaultToFirstItem },
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    description: '',
    requiredFirst,
  }) as unknown as Filter;

// Renders the filter's control items in a real form seeded from a stored
// filter, the way the config modal does, and returns the form instance.
function renderSeededForm(filterToEdit: Filter) {
  let formInstance: FormInstance<NativeFiltersForm> | undefined;
  const Harness = () => {
    const [form] = Form.useForm<NativeFiltersForm>();
    formInstance = form;
    const { controlItems } = getControlItemsMap({
      expanded: false,
      datasetId: 42,
      disabled: false,
      forceUpdate: jest.fn(),
      formChanged: jest.fn(),
      form,
      filterId: FILTER_ID,
      filterType: 'filter_select',
      filterToEdit,
    });
    return (
      <Form form={form}>
        {Object.values(controlItems).map(item => item.element)}
      </Form>
    );
  };
  render(<Harness />);
  return formInstance!;
}

// What the modal would save for this filter after editing it.
function saveFromForm(form: FormInstance<NativeFiltersForm>) {
  const values = form.getFieldsValue(true).filters[FILTER_ID];
  return transformFilterForSave(FILTER_ID, {
    name: 'Region',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    dataset: { value: 42, label: 'sales' },
    column: 'region',
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    description: '',
    ...values,
  } as NativeFiltersFormItem) as Filter;
}

beforeEach(() => {
  (getControlItems as jest.Mock).mockReturnValue([
    {
      name: 'defaultToFirstItem',
      config: {
        renderTrigger: true,
        requiredFirst: true,
        resetConfig: true,
        affectsDataMask: true,
      },
    },
  ]);
});

test.each([
  ['true, box ticked', true, true, true],
  ['a ticked event, box ticked', storedCheckboxEvent(true), true, true],
  [
    'an unticked event, box unticked',
    storedCheckboxEvent(false),
    false,
    undefined,
  ],
  ['an empty object, box ticked', {}, true, true],
  ['an empty object, box unticked', {}, false, undefined],
])(
  'editing a filter that stores %s saves requiredFirst as a boolean flag',
  (_, stored, boxChecked, expected) => {
    const form = renderSeededForm(savedFilter(stored, boxChecked));

    expect(saveFromForm(form).requiredFirst).toBe(expected);
  },
);

test('unticking a filter that stores a ticked event removes requiredFirst', async () => {
  const form = renderSeededForm(savedFilter(storedCheckboxEvent(true), true));

  await userEvent.click(screen.getByRole('checkbox'));

  expect(saveFromForm(form).requiredFirst).toBeUndefined();
});

test('ticking a filter that stores an unticked event sets requiredFirst', async () => {
  const form = renderSeededForm(savedFilter(storedCheckboxEvent(false), false));

  await userEvent.click(screen.getByRole('checkbox'));

  expect(saveFromForm(form).requiredFirst).toBe(true);
});
