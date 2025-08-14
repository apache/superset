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
import { render, screen } from 'spec/helpers/testing-library';
import '@testing-library/jest-dom';
import { ChartSource } from 'src/types/ChartSource';
import { useChartOwnerNames } from 'src/hooks/apiResources';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { ErrorType } from '@superset-ui/core';
import type { ErrorMessageComponentProps } from 'src/components/ErrorMessage/types';
import { getErrorMessageComponentRegistry } from 'src/components/ErrorMessage';
import { ChartErrorMessage } from './ChartErrorMessage';

// Mock the useChartOwnerNames hook
jest.mock('src/hooks/apiResources', () => ({
  useChartOwnerNames: jest.fn(),
}));

const mockUseChartOwnerNames = useChartOwnerNames as jest.MockedFunction<
  typeof useChartOwnerNames
>;

const ERROR_MESSAGE_COMPONENT = (props: ErrorMessageComponentProps) => (
  <>
    <div>Test error</div>
    <div>{props.subtitle}</div>
  </>
);

describe('ChartErrorMessage', () => {
  const defaultProps = {
    chartId: 1,
    subtitle: 'Test subtitle',
    source: 'test_source' as ChartSource,
  };

  it('renders the default error message when error is null', () => {
    mockUseChartOwnerNames.mockReturnValue({
      result: null,
      status: ResourceStatus.Loading,
      error: null,
    });
    render(<ChartErrorMessage {...defaultProps} />);

    expect(screen.getByText('Data error')).toBeInTheDocument();
    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });

  it('renders the error message that is passed in from the error', () => {
    getErrorMessageComponentRegistry().registerValue(
      'VALID_KEY',
      ERROR_MESSAGE_COMPONENT,
    );
    render(
      <ChartErrorMessage
        {...defaultProps}
        error={{
          error_type: 'VALID_KEY' as unknown as ErrorType,
          message: 'Subtitle',
          level: 'error',
          extra: {},
        }}
      />,
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });
});
