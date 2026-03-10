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
import '@testing-library/jest-dom';
import { PLACEHOLDER_DATASOURCE } from 'src/dashboard/constants';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import Chart from './Chart';
import type { Actions } from './Chart';

const mockActions: Actions = {
  logEvent: jest.fn() as unknown as Actions['logEvent'],
  chartRenderingFailed: jest.fn() as unknown as Actions['chartRenderingFailed'],
  chartRenderingSucceeded:
    jest.fn() as unknown as Actions['chartRenderingSucceeded'],
  postChartFormData: jest.fn() as unknown as Actions['postChartFormData'],
};

const baseProps = {
  chartId: 1,
  width: 800,
  height: 600,
  actions: mockActions,
  formData: { datasource: '1__table', viz_type: 'table' },
  vizType: 'table',
  setControlValue: jest.fn(),
};

test('shows backend error instead of loading spinner when datasource is still a placeholder', () => {
  render(
    <Chart
      {...baseProps}
      chartStatus="failed"
      chartAlert="Your default credentials were not found."
      datasource={PLACEHOLDER_DATASOURCE}
      datasetsStatus={ResourceStatus.Loading}
      queriesResponse={[
        {
          errors: [
            {
              error_type: 'GENERIC_BACKEND_ERROR',
              message: 'Your default credentials were not found.',
              extra: {
                issue_codes: [{ code: 1011, message: 'Issue 1011' }],
              },
              level: 'error',
            },
          ],
        },
      ]}
    />,
  );

  expect(
    screen.getByText(/Your default credentials were not found/),
  ).toBeInTheDocument();
});

test('shows loading spinner for client-side errors without errors array when datasource is still a placeholder', () => {
  render(
    <Chart
      {...baseProps}
      chartStatus="failed"
      chartAlert="Some client-side error"
      datasource={PLACEHOLDER_DATASOURCE}
      datasetsStatus={ResourceStatus.Loading}
      queriesResponse={[{}]}
    />,
  );

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText(/Some client-side error/)).not.toBeInTheDocument();
});
