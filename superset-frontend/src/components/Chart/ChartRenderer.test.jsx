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
import { render } from 'spec/helpers/testing-library';

import ChartRenderer from 'src/components/Chart/ChartRenderer';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ formData }) => (
    <div data-test="mock-super-chart">{JSON.stringify(formData)}</div>
  ),
}));

jest.mock(
  'src/components/Chart/ChartContextMenu/ChartContextMenu',
  () => () => <div data-test="mock-chart-context-menu" />,
);

const requiredProps = {
  chartId: 1,
  datasource: {},
  formData: { testControl: 'foo' },
  latestQueryFormData: {
    testControl: 'bar',
  },
  vizType: 'table',
};

test('should render SuperChart', () => {
  const { getByTestId } = render(
    <ChartRenderer {...requiredProps} chartIsStale={false} />,
  );
  expect(getByTestId('mock-super-chart')).toBeInTheDocument();
});

test('should use latestQueryFormData instead of formData when chartIsStale is true', () => {
  const { getByTestId } = render(
    <ChartRenderer {...requiredProps} chartIsStale />,
  );
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify({ testControl: 'bar' }),
  );
});
