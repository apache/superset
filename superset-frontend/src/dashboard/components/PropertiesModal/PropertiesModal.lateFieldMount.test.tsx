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
import { render, screen } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
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

// jsdom mounts the section synchronously, so the browser ordering has to be
// forced: the title field registers only after the data-ready validation ran.
jest.mock('./sections/BasicInfoSection', () => {
  const { createElement, useEffect, useState } = jest.requireActual('react');
  const Actual = jest.requireActual('./sections/BasicInfoSection').default;
  const Deferred = (props: Record<string, unknown>) => {
    const [ready, setReady] = useState(false);
    useEffect(() => {
      setReady(true);
    }, []);
    return ready ? createElement(Actual, props) : null;
  };
  return { __esModule: true, default: Deferred };
});

fetchMock.get('glob:*/api/v1/dashboard/26*', {
  body: {
    result: {
      id: 26,
      dashboard_title: 'COVID Vaccine Dashboard',
      slug: null,
      css: '',
      certified_by: '',
      certification_details: '',
      editors: [],
      viewers: [],
      metadata: { refresh_frequency: 0 },
    },
  },
});
fetchMock.get('glob:*/api/v1/theme/*', { body: { result: [] } });

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('Apply is enabled on the first open when the title field registers after the data loads', async () => {
  render(
    <PropertiesModal
      dashboardId={26}
      show
      onlyApply
      onHide={jest.fn()}
      onSubmit={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    { useRedux: true },
  );

  expect(
    await screen.findByTestId('dashboard-edit-properties-form'),
  ).toBeInTheDocument();
  expect(await screen.findByTestId('dashboard-title-input')).toHaveValue(
    'COVID Vaccine Dashboard',
  );

  expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  expect(
    screen.queryByText('Dashboard name is required'),
  ).not.toBeInTheDocument();
});
