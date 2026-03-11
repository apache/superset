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
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { noOp } from 'src/utils/common';
import DrillByChart from './DrillByChart';

const chart = chartQueries[sliceId];
const dataset = {
  changed_on_humanized: '01-01-2001',
  created_on_humanized: '01-01-2001',
  description: 'desc',
  table_name: 'my_dataset',
  owners: [
    {
      first_name: 'Sarah',
      last_name: 'Connor',
    },
  ],
  columns: [
    {
      column_name: 'gender',
    },
    { column_name: 'name' },
  ],
};

const setup = (overrides: Record<string, any> = {}, result?: any) =>
  render(
    <DrillByChart
      formData={{ ...chart.form_data, ...overrides }}
      onContextMenu={noOp}
      inContextMenu={false}
      result={result}
      dataset={dataset}
    />,
    {
      useRedux: true,
    },
  );

const waitForRender = (overrides: Record<string, any> = {}) =>
  waitFor(() => setup(overrides));

test('should render', async () => {
  const { container } = await waitForRender();
  expect(container).toBeInTheDocument();
});

test('should render the "No results" components', async () => {
  setup({}, []);
  expect(await screen.findByText('No Results')).toBeInTheDocument();
});
