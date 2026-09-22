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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { CsrfErrorMessage } from './CsrfErrorMessage';

jest.mock(
  '@superset-ui/core/components/Icons/AsyncIcon',
  () =>
    ({ fileName }: { fileName: string }) =>
      (
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- mirrors AsyncIcon's real span+role="img" shape
        <span role="img" aria-label={fileName.replace('_', '-')} />
      ),
);

const mockedProps = {
  error: {
    error_type: ErrorTypeEnum.CSRF_ERROR,
    extra: {},
    level: 'warning' as ErrorLevel,
    message: '400 Bad Request: The CSRF token has expired.',
  },
  source: 'crud' as ErrorSource,
};

test('should render', () => {
  const nullExtraProps = {
    ...mockedProps,
    error: {
      ...mockedProps.error,
      extra: null,
    },
  };
  const { container } = render(<CsrfErrorMessage {...nullExtraProps} />);
  expect(container).toBeInTheDocument();
});

test('should tell the user how to recover rather than blaming the database', () => {
  render(<CsrfErrorMessage {...mockedProps} />, { useRedux: true });

  expect(screen.getByText('Security token error')).toBeInTheDocument();
  expect(
    screen.getByText('Reload the page and try again to continue.'),
  ).toBeInTheDocument();
  // Regression guard for the mislabelling in issue #43550, where this landed
  // on DatabaseErrorMessage via GENERIC_BACKEND_ERROR and read "DB engine
  // Error".
  expect(screen.queryByText('DB engine Error')).not.toBeInTheDocument();
});

test("should render error message in compact mode if 'compact' is true", () => {
  render(<CsrfErrorMessage {...mockedProps} compact />, { useRedux: true });

  expect(
    screen.queryByText('Reload the page and try again to continue.'),
  ).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button'));
  expect(
    screen.getByText('Reload the page and try again to continue.'),
  ).toBeInTheDocument();
});
