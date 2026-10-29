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
import type { QueryWarningConfirmation } from './useQueryCostWarning';

const estimate: QueryWarningConfirmation = {
  action: 'confirm',
  reason: 'warning',
  message: 'Above threshold',
  details: [
    {
      label: 'Estimated usage',
      value: 'At least 9,007,199,254,740,993,123 bytes',
    },
    { label: 'Warning threshold', value: '9,007,199,254,740,991 bytes' },
  ],
};

test('displays server detail strings exactly with explicit actions', () => {
  const onCancel = jest.fn();
  const onContinue = jest.fn();
  const { getByText, getByRole } = render(
    <QueryCostWarningDialog
      estimate={estimate}
      onCancel={onCancel}
      onContinue={onContinue}
    />,
  );
  expect(getByRole('dialog', { name: 'Query warning' })).toBeInTheDocument();
  expect(
    getByText('At least 9,007,199,254,740,993,123 bytes'),
  ).toBeInTheDocument();
  expect(getByText('9,007,199,254,740,991 bytes')).toBeInTheDocument();
  fireEvent.click(getByRole('button', { name: 'Cancel' }));
  fireEvent.click(getByRole('button', { name: 'Run anyway' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test('unavailable assessments show their message without requiring numeric details', () => {
  const { getByText, getByRole } = render(
    <QueryCostWarningDialog
      estimate={{
        action: 'confirm',
        reason: 'unavailable',
        message: 'Templates cannot be assessed',
      }}
      onCancel={() => {}}
      onContinue={() => {}}
    />,
  );
  expect(getByText('Templates cannot be assessed')).toBeInTheDocument();
  expect(getByRole('button', { name: 'Run anyway' })).toBeInTheDocument();
});

test('message and detail rows are plain text, including markup', () => {
  const { getByText, container } = render(
    <QueryCostWarningDialog
      estimate={{
        ...estimate,
        message: '<b>Review this query</b>',
        details: [{ label: '<i>Notice</i>', value: '<img src=x>' }],
      }}
      onCancel={() => {}}
      onContinue={() => {}}
    />,
  );
  expect(getByText('<b>Review this query</b>')).toBeInTheDocument();
  expect(getByText('<img src=x>')).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
});
