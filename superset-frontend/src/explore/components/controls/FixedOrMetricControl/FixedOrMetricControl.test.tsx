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
import userEvent from '@testing-library/user-event';
import FixedOrMetricControl from '.';

const createProps = () => ({
  datasource: {
    columns: [{ column_name: 'Column A' }],
    metrics: [{ metric_name: 'Metric A', expression: 'COUNT(*)' }],
  },
});

test('renders with minimal props', () => {
  render(<FixedOrMetricControl {...createProps()} />);
  expect(screen.getByRole('button')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});

test('renders with default value', () => {
  render(
    <FixedOrMetricControl
      {...createProps()}
      default={{ type: 'fix', value: 10 }}
    />,
  );
  expect(screen.getByRole('button')).toBeInTheDocument();
  expect(screen.getByText('10')).toBeInTheDocument();
});

test('renders with value', () => {
  render(
    <FixedOrMetricControl
      {...createProps()}
      default={{ type: 'fix', value: 10 }}
      value={{ type: 'fix', value: 20 }}
    />,
  );
  expect(screen.getByRole('button')).toBeInTheDocument();
  expect(screen.getByText('20')).toBeInTheDocument();
});

test('renders with metric type', () => {
  render(
    <FixedOrMetricControl
      {...createProps()}
      value={{
        type: 'metric',
        value: {
          label: 'Metric A',
          expressionType: 'SQL',
          sqlExpression: 'COUNT(*)',
        },
      }}
    />,
  );
  expect(screen.getByRole('button')).toBeInTheDocument();
  expect(screen.getByText('Metric A')).toBeInTheDocument();
});

test('triggers onChange', () => {
  const onChange = jest.fn();
  render(
    <FixedOrMetricControl
      {...createProps()}
      value={{ type: 'fix', value: 10 }}
      onChange={onChange}
    />,
  );
  userEvent.click(screen.getByText('10'));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.type(screen.getByRole('textbox'), '20');
  expect(onChange).toHaveBeenCalled();
});

test('switches control type', () => {
  render(
    <FixedOrMetricControl
      {...createProps()}
      value={{ type: 'fix', value: 10 }}
    />,
  );
  userEvent.click(screen.getByText('10'));
  userEvent.click(screen.getByText('Based on a metric'));
  expect(screen.getByText('metric:')).toBeInTheDocument();
  userEvent.click(screen.getByText('Fixed'));
  expect(screen.getByText('10')).toBeInTheDocument();
});
