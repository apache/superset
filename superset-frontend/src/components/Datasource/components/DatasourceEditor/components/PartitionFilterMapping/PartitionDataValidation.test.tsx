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

import fetchMock from 'fetch-mock';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import PartitionDataValidation from './PartitionDataValidation';

const endpoint = 'glob:*/api/v1/dataset/1/partition_mapping/preview/';
const props = {
  datasetId: 1,
  mappedColumn: 'event_time',
  partitionColumn: 'dt_epoch',
  valueTransform: 'unix_timestamp(:value)',
  isMonotonic: true,
  sampleValues: ['2026-01-15 10:47:23'],
  operator: '>=',
};
afterEach(() => fetchMock.clearHistory().removeRoutes());

test('validation is explicit and preserves integer keys as strings', async () => {
  fetchMock.post(endpoint, {
    result: {
      valid: false,
      data_validation: {
        status: 'mismatch',
        checked_rows: 1,
        partitions_checked: 1,
        examples: [
          {
            source_value: '2026-01-15 10:47:23',
            stored_key: '1768471200',
            transformed_value: '1768474043',
          },
        ],
      },
    },
  });
  render(<PartitionDataValidation {...props} />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '9007199254740993' },
  });
  expect(fetchMock.callHistory.called(endpoint)).toBe(false);
  await userEvent.click(
    screen.getByRole('button', { name: 'Validate against data' }),
  );
  expect(
    await screen.findByText('Partition mismatch found'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/stored key: 1768471200; transform: 1768474043/),
  ).toBeInTheDocument();
  const call = fetchMock.callHistory.lastCall(endpoint);
  expect(
    JSON.parse(call?.options.body as string).validation_partition_values,
  ).toEqual(['9007199254740993']);
});

test('changing a candidate clears sampled success', async () => {
  fetchMock.post(endpoint, {
    result: {
      valid: true,
      data_validation: {
        status: 'matched',
        checked_rows: 50,
        partitions_checked: 1,
      },
    },
  });
  const { rerender } = render(<PartitionDataValidation {...props} />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '1768471200' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Validate against data' }),
  );
  expect(
    await screen.findByText('Matched 50 sampled rows across 1 partition'),
  ).toBeInTheDocument();
  rerender(
    <PartitionDataValidation
      {...props}
      valueTransform="floor(:value/3600)*3600"
    />,
  );
  expect(screen.queryByText(/Matched 50/)).not.toBeInTheDocument();
});

test('late validation cannot describe a changed candidate', async () => {
  let resolveResponse: (value: object) => void = () => {};
  fetchMock.post(
    endpoint,
    () =>
      new Promise(resolve => {
        resolveResponse = resolve;
      }),
  );
  const { rerender } = render(<PartitionDataValidation {...props} />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '1768471200' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Validate against data' }),
  );
  rerender(<PartitionDataValidation {...props} partitionColumn="other_key" />);
  resolveResponse({
    result: {
      valid: true,
      data_validation: {
        status: 'matched',
        checked_rows: 1,
        partitions_checked: 1,
      },
    },
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Validate against data' }),
    ).toBeEnabled(),
  );
  expect(screen.queryByText(/Matched 1/)).not.toBeInTheDocument();
});

test('empty, invalid, and excessive partition selections cannot run', () => {
  render(<PartitionDataValidation {...props} />);
  for (const value of [
    '',
    'abc',
    '1,2,3,4',
    '12345678901234567890',
    '9223372036854775808',
  ]) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value } });
    expect(
      screen.getByRole('button', { name: 'Validate against data' }),
    ).toBeDisabled();
    expect(
      screen.getByTestId('partition-validation-disabled'),
    ).toBeInTheDocument();
  }
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '-9223372036854775808, 9223372036854775807' },
  });
  expect(
    screen.getByRole('button', { name: 'Validate against data' }),
  ).toBeEnabled();
  expect(
    screen.queryByTestId('partition-validation-disabled'),
  ).not.toBeInTheDocument();
});

test('a disabled button says why', () => {
  render(
    <PartitionDataValidation
      {...props}
      disabledReason="Correct the value transform before validating against data."
    />,
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '1768471200' },
  });
  expect(
    screen.getByRole('button', { name: 'Validate against data' }),
  ).toBeDisabled();
  expect(
    screen.getByText(
      'Correct the value transform before validating against data.',
    ),
  ).toBeInTheDocument();
});

test('a refused transform is never reported as matched', async () => {
  fetchMock.post(endpoint, {
    result: {
      valid: false,
      data_validation: {
        status: 'refused',
        message: 'Filters will not be mirrored.',
      },
    },
  });
  render(<PartitionDataValidation {...props} />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '1768471200' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Validate against data' }),
  );
  expect(
    await screen.findByText('Filters will not be mirrored'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Matched/)).not.toBeInTheDocument();
});
