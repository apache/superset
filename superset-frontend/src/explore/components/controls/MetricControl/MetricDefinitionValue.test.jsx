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
import MetricDefinitionValue from 'src/explore/components/controls/MetricControl/MetricDefinitionValue';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { AGGREGATES } from 'src/explore/constants';

const sumValueAdhocMetric = new AdhocMetric({
  column: { type: 'DOUBLE', column_name: 'value' },
  aggregate: AGGREGATES.SUM,
});

const setup = propOverrides => {
  const props = {
    onMetricEdit: jest.fn(),
    option: sumValueAdhocMetric,
    index: 1,
    columns: [],
    savedMetrics: [],
    savedMetricsOptions: [],
    datasource: {},
    onMoveLabel: jest.fn(),
    onDropLabel: jest.fn(),
    ...propOverrides,
  };
  return render(<MetricDefinitionValue {...props} />, { useDnd: true });
};

test('renders a MetricOption given a saved metric', () => {
  setup({
    option: { metric_name: 'a_saved_metric', expression: 'COUNT(*)' },
  });
  expect(screen.getByText('a_saved_metric')).toBeInTheDocument();
});

test('renders an AdhocMetricOption given an adhoc metric', () => {
  setup();
  expect(screen.getByText('SUM(value)')).toBeInTheDocument();
});
