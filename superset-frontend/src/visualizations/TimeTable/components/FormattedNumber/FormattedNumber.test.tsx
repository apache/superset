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
import { render, screen } from '@superset-ui/core/spec';
import FormattedNumber from './FormattedNumber';

test('should render number without format', () => {
  render(<FormattedNumber num={12345} />);
  expect(screen.getByText('12345')).toBeInTheDocument();
});

test('should render formatted number with format string', () => {
  render(<FormattedNumber num={12345.6789} format=".2f" />);
  expect(screen.getByText('12345.68')).toBeInTheDocument();
});

test('should render with percentage format', () => {
  render(<FormattedNumber num={0.456} format=".1%" />);
  expect(screen.getByText('45.6%')).toBeInTheDocument();
});

test('should render with thousands separator', () => {
  render(<FormattedNumber num={1234567} format="," />);
  expect(screen.getByText('1,234,567')).toBeInTheDocument();
});

test('should render zero when num is undefined', () => {
  render(<FormattedNumber format=".2f" />);
  expect(screen.getByText('0.00')).toBeInTheDocument();
});

test('should render zero without format when num is undefined', () => {
  render(<FormattedNumber />);
  expect(screen.getByText('0')).toBeInTheDocument();
});

test('should have title attribute with original number when formatted', () => {
  render(<FormattedNumber num={12345.6789} format=".2f" />);

  const span = screen.getByText('12345.68');

  expect(span).toHaveAttribute('title', '12345.6789');
});

test('should not have title attribute when no format is applied', () => {
  render(<FormattedNumber num={12345} />);

  const span = screen.getByText('12345');

  expect(span).not.toHaveAttribute('title');
});

test('should handle string numbers', () => {
  render(<FormattedNumber num="12345" />);
  expect(screen.getByText('12345')).toBeInTheDocument();
});

test('should handle string numbers with format', () => {
  render(<FormattedNumber num="12345.6789" format=".2f" />);
  expect(screen.getByText('12345.68')).toBeInTheDocument();
});

test('should handle negative numbers', () => {
  render(<FormattedNumber num={-12345.67} format=".2f" />);
  expect(screen.getByText('-12345.67')).toBeInTheDocument();
});

test('should handle very large numbers', () => {
  render(<FormattedNumber num={1.234e12} format=".3s" />);
  expect(screen.getByText('1.23T')).toBeInTheDocument();
});

test('should handle invalid string numbers with format', () => {
  render(<FormattedNumber num="invalid" format=".2f" />);
  expect(screen.getByText('0.00')).toBeInTheDocument();
});

test('should handle null values', () => {
  render(<FormattedNumber num={null} />);
  expect(screen.getByText('0')).toBeInTheDocument();
});
