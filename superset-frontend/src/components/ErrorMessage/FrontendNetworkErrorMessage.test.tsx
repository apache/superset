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
import FrontendNetworkErrorMessage from './FrontendNetworkErrorMessage';

jest.mock(
  'src/components/Icons/Icon',
  () =>
    ({ fileName }: { fileName: string }) => (
      <span role="img" aria-label={fileName.replace('_', '-')} />
    ),
);

const mockedProps = {
  error: {
    error_type: ErrorTypeEnum.FRONTEND_NETWORK_ERROR,
    extra: {},
    level: 'error' as ErrorLevel,
    message: 'Error message',
  },
  source: 'dashboard' as ErrorSource,
  subtitle: 'Error message',
};

test('should render', () => {
  const nullExtraProps = {
    ...mockedProps,
    error: {
      ...mockedProps.error,
      extra: null,
    },
  };
  const { container } = render(
    <FrontendNetworkErrorMessage {...nullExtraProps} />,
  );
  expect(container).toBeInTheDocument();
});

test('should render the error message', () => {
  render(<FrontendNetworkErrorMessage {...mockedProps} />, { useRedux: true });
  expect(screen.getByText('Error message')).toBeInTheDocument();
});

test("should render error message in compact mode if 'compact' is true", () => {
  render(<FrontendNetworkErrorMessage {...mockedProps} compact />, {
    useRedux: true,
  });
  expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Error message')).toBeInTheDocument();
});
