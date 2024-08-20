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

import userEvent from '@testing-library/user-event';
import { ErrorLevel, ErrorSource, ErrorTypeEnum } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import ParameterErrorMessage from './ParameterErrorMessage';

jest.mock(
  'src/components/Icons/Icon',
  () =>
    ({ fileName }: { fileName: string }) => (
      <span role="img" aria-label={fileName.replace('_', '-')} />
    ),
);

const mockedProps = {
  error: {
    error_type: ErrorTypeEnum.MISSING_TEMPLATE_PARAMS_ERROR,
    extra: {
      template_parameters: { state: 'CA', country: 'ITA' },
      undefined_parameters: ['stat', 'count'],
      issue_codes: [
        {
          code: 1,
          message: 'Issue code message A',
        },
        {
          code: 2,
          message: 'Issue code message B',
        },
      ],
    },
    level: 'error' as ErrorLevel,
    message: 'Error message',
  },
  source: 'dashboard' as ErrorSource,
  subtitle: 'Error message',
};

test('should render', () => {
  const { container } = render(<ParameterErrorMessage {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render the default title', () => {
  render(<ParameterErrorMessage {...mockedProps} />);
  expect(screen.getByText('Parameter error')).toBeInTheDocument();
});

test('should render the error message', () => {
  render(<ParameterErrorMessage {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText('Error message')).toBeInTheDocument();
});

test('should render the issue codes', () => {
  render(<ParameterErrorMessage {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText(/This may be triggered by:/)).toBeInTheDocument();
  expect(screen.getByText(/Issue code message A/)).toBeInTheDocument();
  expect(screen.getByText(/Issue code message B/)).toBeInTheDocument();
});

test('should render the suggestions', () => {
  render(<ParameterErrorMessage {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText(/Did you mean:/)).toBeInTheDocument();
  expect(screen.getByText('"state" instead of "stat?"')).toBeInTheDocument();
  expect(screen.getByText('"country" instead of "count?"')).toBeInTheDocument();
});
