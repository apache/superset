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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
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

const customizationToEdit: ChartCustomization = {
  id: FILTER_ID,
  name: 'Group By',
  filterType: ChartCustomizationPlugins.DynamicGroupBy,
  type: ChartCustomizationType.ChartCustomization,
  targets: [{ datasetId: 1 }],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  controlValues: { columnsAllowlist: ['country'] },
  defaultDataMask: {},
};

const noop = () => {};

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

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('shows the Groupable columns allowlist control for the Group By customization', async () => {
  render(<Harness />, {
    useRedux: true,
    initialState: {
      dashboardInfo: { id: 1 },
      datasources: {},
      charts: {},
    },
  });

  await waitFor(() =>
    expect(screen.getByText('Groupable columns')).toBeInTheDocument(),
  );

  // The previously-configured allowlist column is rendered as a selected value,
  // proving the control reads back its persisted controlValues.columnsAllowlist.
  expect(await screen.findByText('country')).toBeInTheDocument();
});
