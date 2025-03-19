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
import userEvent from '@testing-library/user-event';
import ErrorMessageWithStackTrace from './ErrorMessageWithStackTrace';
import BasicErrorAlert from './BasicErrorAlert';

jest.mock(
  'src/components/Icons/Icon',
  () =>
    ({ fileName }: { fileName: string }) => (
      <span role="img" aria-label={fileName.replace('_', '-')} />
    ),
);

const mockedProps = {
  level: 'warning' as ErrorLevel,
  link: 'https://sample.com',
  source: 'dashboard' as ErrorSource,
  stackTrace: 'Stacktrace',
};

test('should render', () => {
  const { container } = render(<ErrorMessageWithStackTrace {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render the stacktrace', () => {
  render(<ErrorMessageWithStackTrace {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText('Stacktrace')).toBeInTheDocument();
});

test('should render the link', () => {
  render(<ErrorMessageWithStackTrace {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  const link = screen.getByRole('link');
  expect(link).toHaveTextContent('(Request Access)');
  expect(link).toHaveAttribute('href', mockedProps.link);
});

test('should render the fallback', () => {
  const body = 'Blahblah';
  render(
    <ErrorMessageWithStackTrace
      error={{
        error_type: ErrorTypeEnum.FRONTEND_NETWORK_ERROR,
        message: body,
        extra: {},
        level: 'error',
      }}
      fallback={<BasicErrorAlert title="Blah" body={body} level="error" />}
      {...mockedProps}
    />,
    { useRedux: true },
  );
  expect(screen.getByText(body)).toBeInTheDocument();
});
