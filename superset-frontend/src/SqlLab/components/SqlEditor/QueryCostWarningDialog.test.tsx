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
import { fireEvent, render } from 'spec/helpers/testing-library';
import QueryCostWarningDialog from './QueryCostWarningDialog';
import type { WarningEstimate } from './useQueryCostWarning';

const estimate: WarningEstimate = {
  status: 'exceeded',
  metric: 'bytes_processed',
  label: 'Estimated bytes processed',
  unit: 'bytes',
  value: BigInt('9007199254740993123'),
  threshold: 9007199254740991,
  message: 'Above threshold',
  accuracy: 'LOWER_BOUND',
};

test('shows exact large byte values and bound accuracy with explicit actions', () => {
  const onCancel = jest.fn();
  const onContinue = jest.fn();
  const { getByText, getByRole } = render(
    <QueryCostWarningDialog
      estimate={estimate}
      onCancel={onCancel}
      onContinue={onContinue}
    />,
  );
  expect(getByText('9,007,199,254,740,993,123 bytes')).toBeInTheDocument();
  expect(getByText('9,007,199,254,740,991 bytes')).toBeInTheDocument();
  expect(getByText(/lower bound/)).toBeInTheDocument();
  fireEvent.click(getByRole('button', { name: 'Cancel' }));
  fireEvent.click(getByRole('button', { name: 'Run anyway' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test('upper-bound byte estimates identify their accuracy', () => {
  const { getByText, queryByText } = render(
    <QueryCostWarningDialog
      estimate={{ ...estimate, accuracy: 'UPPER_BOUND' }}
      onCancel={() => {}}
      onContinue={() => {}}
    />,
  );
  expect(getByText(/upper bound/)).toBeInTheDocument();
  expect(queryByText(/lower bound/)).not.toBeInTheDocument();
});

test('unavailable planner cost shows its reason and Run without estimate', () => {
  const { getByText, getByRole } = render(
    <QueryCostWarningDialog
      estimate={{
        ...estimate,
        status: 'unavailable',
        metric: 'total_cost',
        unit: 'planner cost units',
        value: null,
        threshold: 12.5,
        message: 'Templates cannot be estimated',
      }}
      onCancel={() => {}}
      onContinue={() => {}}
    />,
  );
  expect(getByText('Templates cannot be estimated')).toBeInTheDocument();
  expect(
    getByText('Planner cost is relative, not dollars or memory.'),
  ).toBeInTheDocument();
  expect(
    getByRole('button', { name: 'Run without estimate' }),
  ).toBeInTheDocument();
});
