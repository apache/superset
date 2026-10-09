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
import {
  Behavior,
  ChartMetadata,
  ChartCustomization,
  ChartCustomizationType,
  getChartMetadataRegistry,
} from '@superset-ui/core';
import { Form, type FormInstance } from '@superset-ui/core/components';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { ChartCustomizationPlugins } from 'src/constants';
import { transformCustomizationForSave } from '../transformers/customizationTransformer';
import { ChartCustomizationsFormItem, NativeFiltersForm } from '../types';
import FiltersConfigForm from './FiltersConfigForm';

// Register a minimal Group By customization so the config form treats it as a
// dataset-backed chart customization (datasourceCount > 0 -> hasDataset).
getChartMetadataRegistry().registerValue(
  ChartCustomizationPlugins.DynamicGroupBy,
  new ChartMetadata({
    name: 'Group By',
    datasourceCount: 1,
    behaviors: [Behavior.ChartCustomization],
    thumbnail: '',
  }),
);

fetchMock.get('glob:*/api/v1/dataset/1?*', {
  result: {
    columns: [
      { column_name: 'country', is_dttm: false, filterable: true },
      { column_name: 'state', is_dttm: false, filterable: true },
    ],
  },
});

// A column whose `filterable` flag is null (legacy rows; the column is
// nullable in the metadata DB). The viewer offers it, so the allowlist must
// too.
fetchMock.get('glob:*/api/v1/dataset/2?*', {
  result: {
    columns: [
      { column_name: 'country', is_dttm: false, filterable: true },
      { column_name: 'legacy_col', is_dttm: false, filterable: null },
      { column_name: 'internal_only', is_dttm: false, filterable: false },
    ],
  },
});

// Columns whose verbose names differ from column_name.
fetchMock.get('glob:*/api/v1/dataset/3?*', {
  result: {
    columns: [
      {
        column_name: 'region',
        verbose_name: 'Sales Region',
        is_dttm: false,
        filterable: true,
      },
      { column_name: 'country', is_dttm: false, filterable: true },
    ],
  },
});

// The dataset picker's list endpoint (path-matched so it never shadows the
// per-dataset column endpoints above).
fetchMock.get('path:/api/v1/dataset/', {
  result: [
    {
      id: 1,
      table_name: 'sales',
      schema: 'public',
      database: { database_name: 'examples' },
    },
    {
      id: 2,
      table_name: 'legacy_sales',
      schema: 'public',
      database: { database_name: 'examples' },
    },
  ],
  count: 2,
});

const FILTER_ID = 'CHART_CUSTOMIZATION-groupby';

const noop = () => {};

function renderForm({
  customizationToEdit,
  initialControlValues,
  datasetId = 1,
  onForm,
}: {
  customizationToEdit?: ChartCustomization;
  initialControlValues?: Record<string, unknown>;
  datasetId?: number;
  onForm?: (form: FormInstance<NativeFiltersForm>) => void;
} = {}) {
  function Harness() {
    const [form] = Form.useForm<NativeFiltersForm>();
    onForm?.(form);
    return (
      <Form
        form={form}
        initialValues={{
          filters: {
            [FILTER_ID]: {
              filterType: ChartCustomizationPlugins.DynamicGroupBy,
              dataset: { value: datasetId, label: 'sales' },
              ...(initialControlValues
                ? { controlValues: initialControlValues }
                : {}),
            },
          },
        }}
      >
        <FiltersConfigForm
          filterId={FILTER_ID}
          itemType="chartCustomization"
          form={form}
          customizationToEdit={customizationToEdit}
          expanded
          removedFilters={{}}
          restoreFilter={noop}
          onModifyFilter={noop}
          getAvailableFilters={() => []}
          handleActiveFilterPanelChange={noop}
          activeFilterPanelKeys={[`${FILTER_ID}-configuration`]}
          isActive
          setErroredFilters={() => []}
          validateDependencies={noop}
          getDependencySuggestion={() => ''}
        />
      </Form>
    );
  }

  return render(<Harness />, {
    useRedux: true,
    initialState: {
      dashboardInfo: { id: 1 },
      datasources: {},
      charts: {},
    },
  });
}

// Scopes queries to the Groupable columns multi-select. antd only renders
// picked values (not the closed dropdown options) as selection items, so text
// found inside this Form.Item reflects the current allowlist selection.
async function getAllowlistScope() {
  const label = await screen.findByText('Groupable columns');
  const formItem = label.closest('.ant-form-item') as HTMLElement;
  return within(formItem);
}

const customizationWithNarrowedAllowlist: ChartCustomization = {
  id: FILTER_ID,
  name: 'Group By',
  filterType: ChartCustomizationPlugins.DynamicGroupBy,
  type: ChartCustomizationType.ChartCustomization,
  targets: [{ datasetId: 1 }],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  controlValues: { columnsAllowlist: ['country'] },
  defaultDataMask: {},
};

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('shows the Groupable columns allowlist control for the Group By customization', async () => {
  renderForm({ customizationToEdit: customizationWithNarrowedAllowlist });

  await waitFor(() =>
    expect(screen.getByText('Groupable columns')).toBeInTheDocument(),
  );

  // The previously-configured allowlist column is rendered as a selected value,
  // proving the control reads back its persisted controlValues.columnsAllowlist.
  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('country')).toBeInTheDocument();
});

test('seeds a new control with every groupable column selected by default', async () => {
  // No customizationToEdit and no configured allowlist: a freshly created
  // control. Once the dataset's columns load, the allowlist should default to
  // ALL groupable columns so builders start from "all selected".
  renderForm();

  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('country')).toBeInTheDocument();
  expect(await allowlist.findByText('state')).toBeInTheDocument();
});

test('does not overwrite an existing narrowed allowlist when editing', async () => {
  // Editing a control that already narrowed the allowlist to a single column
  // must keep that selection; the seeding default only applies to new controls.
  renderForm({
    customizationToEdit: customizationWithNarrowedAllowlist,
    initialControlValues: { columnsAllowlist: ['country'] },
  });

  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('country')).toBeInTheDocument();
  // 'state' is a valid option but was deliberately excluded, so it must not be
  // seeded back in as a selected value.
  await waitFor(() =>
    expect(allowlist.queryByText('state')).not.toBeInTheDocument(),
  );
});

test('offers and seeds columns whose filterable flag is null, matching the viewer', async () => {
  renderForm({ datasetId: 2 });

  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('country')).toBeInTheDocument();
  expect(await allowlist.findByText('legacy_col')).toBeInTheDocument();
  // Explicitly non-filterable columns stay out, as in the viewer.
  expect(allowlist.queryByText('internal_only')).not.toBeInTheDocument();
});

const legacyCustomization: ChartCustomization = {
  ...customizationWithNarrowedAllowlist,
  // Saved before the allowlist existed: no columnsAllowlist at all.
  controlValues: { canSelectMultiple: true },
};

const saveFormValues = async (form: FormInstance<NativeFiltersForm>) => {
  const values = (await form.validateFields()) as NativeFiltersForm;
  return transformCustomizationForSave(
    FILTER_ID,
    values.filters[FILTER_ID] as unknown as ChartCustomizationsFormItem,
  ) as ChartCustomization;
};

test('editing a legacy control leaves columnsAllowlist unset on save unless narrowed', async () => {
  let form!: FormInstance<NativeFiltersForm>;
  renderForm({
    customizationToEdit: legacyCustomization,
    initialControlValues: { canSelectMultiple: true },
    onForm: f => {
      form = f;
    },
  });

  // The control shows "all selected" once the columns load...
  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('state')).toBeInTheDocument();

  // ...but saving without narrowing does not freeze that snapshot.
  // (This harness registers no control-panel checkboxes, so only the
  // allowlist field is part of the validated controlValues.)
  const saved = await saveFormValues(form);
  expect(saved.controlValues).not.toHaveProperty('columnsAllowlist');
});

test('saves a narrowed allowlist as-is', async () => {
  let form!: FormInstance<NativeFiltersForm>;
  renderForm({
    customizationToEdit: customizationWithNarrowedAllowlist,
    initialControlValues: { columnsAllowlist: ['country'] },
    onForm: f => {
      form = f;
    },
  });

  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('country')).toBeInTheDocument();
  await waitFor(() =>
    expect(
      (
        form.getFieldValue('filters')?.[
          FILTER_ID
        ] as unknown as ChartCustomizationsFormItem
      )?.groupableColumns,
    ).toEqual(['country', 'state']),
  );

  const saved = await saveFormValues(form);
  expect(saved.controlValues).toEqual({ columnsAllowlist: ['country'] });
});

test('loading the allowlist columns does not reset the unrelated column field', async () => {
  let form!: FormInstance<NativeFiltersForm>;
  renderForm({
    customizationToEdit: legacyCustomization,
    initialControlValues: { canSelectMultiple: true },
    onForm: f => {
      form = f;
    },
  });

  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('state')).toBeInTheDocument();
  expect(form.getFieldValue(['filters', FILTER_ID, 'column'])).toBeUndefined();
});

async function pickDataset(tableName: string) {
  const datasetSelect = screen.getByRole('combobox', { name: /dataset/i });
  await userEvent.click(datasetSelect);
  const option = await waitFor(() => {
    // eslint-disable-next-line testing-library/no-node-access
    const list = document.querySelector('.ant-select-dropdown-list');
    if (!list) throw new Error('dataset list not open');
    return within(list as HTMLElement).getByText(tableName);
  });
  await userEvent.click(option);
}

test("switching the dataset away and back never saves the other dataset's columns", async () => {
  let form!: FormInstance<NativeFiltersForm>;
  renderForm({
    customizationToEdit: customizationWithNarrowedAllowlist,
    initialControlValues: { columnsAllowlist: ['country'] },
    onForm: f => {
      form = f;
    },
  });
  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('country')).toBeInTheDocument();

  await pickDataset('legacy_sales');
  expect(await allowlist.findByText('legacy_col')).toBeInTheDocument();
  await pickDataset('sales');
  expect(await allowlist.findByText('state')).toBeInTheDocument();

  const values = form.getFieldValue('filters')?.[
    FILTER_ID
  ] as unknown as ChartCustomizationsFormItem;
  expect(values.controlValues?.columnsAllowlist).toEqual(['country', 'state']);
  expect(values.groupableColumns).toEqual(['country', 'state']);
  // "All selected" on the current dataset saves as unrestricted.
  const saved = await saveFormValues(form);
  expect(saved.controlValues).not.toHaveProperty('columnsAllowlist');
});

test('labels and searches allowlist columns by verbose name', async () => {
  renderForm({ datasetId: 3 });

  const allowlist = await getAllowlistScope();
  // Seeded tags use the verbose name, falling back to column_name.
  expect(await allowlist.findByText('Sales Region')).toBeInTheDocument();
  expect(allowlist.getByText('country')).toBeInTheDocument();

  const combobox = screen.getByRole('combobox', { name: 'Column select' });
  await userEvent.type(combobox, 'Sales Reg');
  expect(
    await screen.findByRole('option', { name: 'Sales Region' }),
  ).toBeInTheDocument();
  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'region');
  expect(
    await screen.findByRole('option', { name: 'Sales Region' }),
  ).toBeInTheDocument();
});

test('explains that an empty allowlist means every groupable column', async () => {
  renderForm({
    customizationToEdit: {
      ...customizationWithNarrowedAllowlist,
      controlValues: { columnsAllowlist: [] },
    },
    initialControlValues: { columnsAllowlist: [] },
  });

  const allowlist = await getAllowlistScope();
  expect(
    await allowlist.findByText('All groupable columns'),
  ).toBeInTheDocument();
  expect(
    allowlist.getByText(/including columns added to the dataset later/),
  ).toBeInTheDocument();
});

test('warns about allowlisted columns the dataset no longer offers', async () => {
  renderForm({
    customizationToEdit: {
      ...customizationWithNarrowedAllowlist,
      controlValues: { columnsAllowlist: ['country', 'dropped_col'] },
    },
    initialControlValues: { columnsAllowlist: ['country', 'dropped_col'] },
  });

  const allowlist = await getAllowlistScope();
  expect(
    await allowlist.findByText(
      'Not in this dataset, so viewers will not see: dropped_col',
    ),
  ).toBeInTheDocument();
});

test('does not warn when every allowlisted column is available', async () => {
  renderForm({
    customizationToEdit: customizationWithNarrowedAllowlist,
    initialControlValues: { columnsAllowlist: ['country'] },
  });

  const allowlist = await getAllowlistScope();
  expect(await allowlist.findByText('country')).toBeInTheDocument();
  expect(
    allowlist.queryByText(/so viewers will not see/),
  ).not.toBeInTheDocument();
});
