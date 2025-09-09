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
import { render } from 'spec/helpers/testing-library';
import ChartSelectUsingAsync from './ChartSelect';

const mockOnChange = jest.fn();

const defaultProps = {
  value: null,
  onChange: mockOnChange,
  datasetId: 123,
  placeholder: 'Select a chart',
  allowClear: true,
  ariaLabel: 'Select drill-to-details chart',
};

test('renders chart select component with default props', () => {
  const { container } = render(<ChartSelectUsingAsync {...defaultProps} />, {
    useRedux: true,
  });
  expect(container.firstChild).toBeInTheDocument();
});

test('renders with custom placeholder', () => {
  const customProps = {
    ...defaultProps,
    placeholder: 'Choose your chart',
  };

  const { container } = render(<ChartSelectUsingAsync {...customProps} />, {
    useRedux: true,
  });
  expect(container.firstChild).toBeInTheDocument();
});

test('renders with selected value', () => {
  const propsWithValue = {
    ...defaultProps,
    value: 456,
  };

  const { container } = render(<ChartSelectUsingAsync {...propsWithValue} />, {
    useRedux: true,
  });
  expect(container.firstChild).toBeInTheDocument();
});

test('renders without dataset filter when datasetId is undefined', () => {
  const propsWithoutDataset = {
    ...defaultProps,
    datasetId: undefined,
  };

  const { container } = render(
    <ChartSelectUsingAsync {...propsWithoutDataset} />,
    { useRedux: true },
  );
  expect(container.firstChild).toBeInTheDocument();
});

test('renders with custom aria label', () => {
  const propsWithCustomAriaLabel = {
    ...defaultProps,
    ariaLabel: 'Custom chart selector',
  };

  const { container } = render(
    <ChartSelectUsingAsync {...propsWithCustomAriaLabel} />,
    { useRedux: true },
  );
  expect(container.firstChild).toBeInTheDocument();
});

test('renders as non-clearable when allowClear is false', () => {
  const nonClearableProps = {
    ...defaultProps,
    allowClear: false,
  };

  const { container } = render(
    <ChartSelectUsingAsync {...nonClearableProps} />,
    { useRedux: true },
  );
  expect(container.firstChild).toBeInTheDocument();
});

test('passes through additional props to SelectAsyncControl', () => {
  const propsWithExtra = {
    ...defaultProps,
    description: 'Test description',
    hovered: true,
    'data-testid': 'chart-select',
  };

  const { container } = render(<ChartSelectUsingAsync {...propsWithExtra} />, {
    useRedux: true,
  });
  expect(container.firstChild).toBeInTheDocument();
});
