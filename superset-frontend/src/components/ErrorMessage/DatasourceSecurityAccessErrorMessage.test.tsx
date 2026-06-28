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
import { DatasourceSecurityAccessErrorMessage } from './DatasourceSecurityAccessErrorMessage';

jest.mock(
  '@superset-ui/core/components/Icons/AsyncIcon',
  () =>
    ({ fileName }: { fileName: string }) => (
      <span role="img" aria-label={fileName.replace('_', '-')} />
    ),
);

const baseProps = {
  error: {
    error_type: ErrorTypeEnum.DATASOURCE_SECURITY_ACCESS_ERROR,
    extra: {
      datasource: 12,
      datasource_name: 'Quarterly Sales',
      owners: ['Jane Doe', 'Bob Smith'],
      link: 'https://access.example.com/request?dataset=12',
      issue_codes: [{ code: 1017, message: 'Permission issue' }],
    },
    level: 'error' as ErrorLevel,
    message:
      'This endpoint requires the datasource 12, database or ' +
      '`all_datasource_access` permission',
  },
  source: 'dashboard' as ErrorSource,
  subtitle: '',
};

test('shows a friendly title and names the dataset', () => {
  render(<DatasourceSecurityAccessErrorMessage {...baseProps} />);
  expect(
    screen.getByText("You don't have access to this chart's data"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Quarterly Sales/)).toBeInTheDocument();
});

test('surfaces the chart owners to contact', () => {
  render(<DatasourceSecurityAccessErrorMessage {...baseProps} />);
  expect(
    screen.getByText(/reach out to the chart owners: Jane Doe, Bob Smith/),
  ).toBeInTheDocument();
});

test('renders a Request access link to the configured URL', () => {
  render(<DatasourceSecurityAccessErrorMessage {...baseProps} />);
  const link = screen.getByRole('link', { name: 'Request access' });
  expect(link).toHaveAttribute(
    'href',
    'https://access.example.com/request?dataset=12',
  );
});

test('falls back to administrator guidance when no owners are known', () => {
  const props = {
    ...baseProps,
    error: {
      ...baseProps.error,
      extra: { datasource_name: 'Quarterly Sales' },
    },
  };
  render(<DatasourceSecurityAccessErrorMessage {...props} />);
  expect(
    screen.getByText(/contact your Superset administrator/),
  ).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Request access' })).toBeNull();
});

test('explains table access for TABLE_SECURITY_ACCESS_ERROR', () => {
  const props = {
    ...baseProps,
    error: {
      ...baseProps.error,
      error_type: ErrorTypeEnum.TABLE_SECURITY_ACCESS_ERROR,
      extra: { tables: ['public.sales', 'public.users'] },
    },
  };
  render(<DatasourceSecurityAccessErrorMessage {...props} />);
  expect(screen.getByText(/public.sales, public.users/)).toBeInTheDocument();
});
