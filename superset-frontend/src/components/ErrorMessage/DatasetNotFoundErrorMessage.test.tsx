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

import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import DatasetNotFoundErrorMessage from './DatasetNotFoundErrorMessage';
import { ErrorLevel, ErrorSource, ErrorTypeEnum } from './types';

jest.mock(
  'src/components/Icons/Icon',
  () =>
    ({ fileName }: { fileName: string }) =>
      <span role="img" aria-label={fileName.replace('_', '-')} />,
);

const mockedProps = {
  error: {
    error_type: ErrorTypeEnum.FAILED_FETCHING_DATASOURCE_INFO_ERROR,
    level: 'error' as ErrorLevel,
    message: 'The dataset associated with this chart no longer exists',
    extra: {},
  },
  source: 'dashboard' as ErrorSource,
};

test('should render', () => {
  const { container } = render(
    <DatasetNotFoundErrorMessage {...mockedProps} />,
  );
  expect(container).toBeInTheDocument();
});

test('should render the default title', () => {
  render(<DatasetNotFoundErrorMessage {...mockedProps} />);
  expect(screen.getByText('Missing dataset')).toBeInTheDocument();
});
