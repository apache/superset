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

import MetricDefinitionOption from 'src/explore/components/controls/MetricControl/MetricDefinitionOption';
import userEvent from '@testing-library/user-event';

const renderMetricDefinitionOption = props => {
  waitFor(() => {
    render(<MetricDefinitionOption {...props} />, {
      useRedux: true,
      useRouter: true,
    });
  });
};

test('MetricDefinitionOption - renders a given saved metric and display SQL expression popover when hovered', async () => {
  renderMetricDefinitionOption({
    option: { metric_name: 'a_saved_metric', expression: 'COUNT(*)' },
  });
  expect(await screen.findByText('a_saved_metric')).toBeInTheDocument();

  // Grab calculator icon and mock mouse hovering over it
  const calculatorIcon = await screen.findByLabelText('calculator');
  userEvent.hover(calculatorIcon);
  expect(await screen.findByText('SQL expression')).toBeInTheDocument();
});

test('MetricDefinitionOption - renders when given a column', async () => {
  renderMetricDefinitionOption({ option: { column_name: 'a_column' } });
  expect(await screen.findByText('a_column')).toBeInTheDocument();
});

test('MetricDefinitionOption - renders when given an aggregate metric', async () => {
  renderMetricDefinitionOption({ option: { aggregate_name: 'an_aggregate' } });
  expect(await screen.findByText('an_aggregate')).toBeInTheDocument();
});
