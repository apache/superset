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

import { ErrorLevel, ErrorSource, ErrorTypeEnum } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import { RowLevelSecurityErrorMessage } from './RowLevelSecurityErrorMessage';

const mockedProps = {
  error: {
    error_type: ErrorTypeEnum.ROW_LEVEL_SECURITY_UNRESOLVABLE,
    level: 'error' as ErrorLevel,
    message:
      'Row-level security could not be applied to this query. ' +
      'Save it as a governed dataset to chart it safely.',
    extra: {},
  },
  source: 'explore' as ErrorSource,
};

test('renders the registry component with an alert role', () => {
  // @AC-FR11-01
  render(<RowLevelSecurityErrorMessage {...mockedProps} />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('renders actionable save-as-governed-dataset copy', () => {
  // @AC-FR11-02
  render(<RowLevelSecurityErrorMessage {...mockedProps} />);
  expect(
    screen.getByText(/save it as a governed dataset/i),
  ).toBeInTheDocument();
});

test('copy is non-disclosive and carries no governed metadata', () => {
  // @AC-FR11-03
  const { container } = render(
    <RowLevelSecurityErrorMessage {...mockedProps} />,
  );
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/\brule\b/i);
  expect(text).not.toMatch(/\btable\b/i);
  expect(text).not.toMatch(/\brow count\b/i);
  expect(text).not.toMatch(/\bfilter\b/i);
  expect(text).not.toMatch(/\bpredicate\b/i);
});

test('does not disclose backend-provided message detail', () => {
  // @AC-FR11-04
  const leaky = {
    ...mockedProps,
    error: {
      ...mockedProps.error,
      message: 'RLS rule on table secret_sales matched 3 rows',
    },
  };
  const { container } = render(<RowLevelSecurityErrorMessage {...leaky} />);
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/secret_sales/i);
  expect(text).not.toMatch(/3 rows/i);
});
