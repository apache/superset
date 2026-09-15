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
import { Form } from '@superset-ui/core/components';
import fetchMock from 'fetch-mock';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import { ChartCustomizationPlugins } from 'src/constants';
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

const FILTER_ID = 'CHART_CUSTOMIZATION-groupby';

const noop = () => {};

function renderForm({
  customizationToEdit,
  initialControlValues,
}: {
  customizationToEdit?: ChartCustomization;
  initialControlValues?: Record<string, unknown>;
} = {}) {
  function Harness() {
    const [form] = Form.useForm();
    return (
      <Form
        form={form}
        initialValues={{
          filters: {
            [FILTER_ID]: {
              filterType: ChartCustomizationPlugins.DynamicGroupBy,
              dataset: { value: 1, label: 'sales' },
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
          activeFilterPanelKeys={[]}
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
