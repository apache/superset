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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { Form } from '@superset-ui/core/components';
import PropertiesModal from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(() => false),
  getCategoricalSchemeRegistry: jest.fn(() => ({
    keys: () => ['supersetColors'],
    get: () => ['#FFFFFF', '#000000'],
    getDefaultKey: () => 'supersetColors',
    getMap: () => ({}),
  })),
}));

fetchMock.get('glob:*/api/v1/theme/*', { body: { result: [] } });

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

// Hydration gives every interactive chart a `chartsInScope` list of all the
// other charts, so `chart_configuration` grows with the square of the chart
// count.
const buildDashboardInfo = (chartCount: number) => {
  const chartIds = Array.from({ length: chartCount }, (_, i) => i + 1);
  const chartConfiguration = Object.fromEntries(
    chartIds.map(id => [
      id,
      {
        id,
        crossFilters: {
          scope: 'global',
          chartsInScope: chartIds.filter(other => other !== id),
        },
      },
    ]),
  );
  return {
    id: 26,
    dashboard_title: 'Many charts',
    slug: null,
    css: '',
    certified_by: '',
    certification_details: '',
    editors: [],
    viewers: [],
    metadata: {
      refresh_frequency: 0,
      chart_configuration: chartConfiguration,
      global_chart_configuration: {
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
        chartsInScope: chartIds,
      },
    },
  };
};

test('does not copy dashboard metadata into the form store on dashboards with many charts', async () => {
  // antd's form store deep-merges every value it is given, which is cubic in
  // the chart count for `chart_configuration`; no form field reads `metadata`.
  const useFormSpy = jest.spyOn(Form, 'useForm');

  render(
    <PropertiesModal
      dashboardId={26}
      dashboardInfo={buildDashboardInfo(333)}
      dashboardTitle="Renamed inline"
      show
      onlyApply
      onHide={jest.fn()}
      onSubmit={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    { useRedux: true },
  );

  await waitFor(() =>
    expect(screen.getByTestId('dashboard-title-input')).toHaveValue(
      'Renamed inline',
    ),
  );

  const [form] = useFormSpy.mock.results[0].value;
  expect(Object.keys(form.getFieldsValue(true))).not.toContain('metadata');
  expect(form.getFieldValue('title')).toBe('Renamed inline');
  useFormSpy.mockRestore();
});
