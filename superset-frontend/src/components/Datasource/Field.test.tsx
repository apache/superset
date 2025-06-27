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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { Input } from '@superset-ui/core/components';

import Field from './Field';

const defaultProps = {
  fieldKey: 'mock',
  value: '',
  label: 'mock',
  description: 'description',
  control: <Input data-test="mock-text-control" />,
  onChange: jest.fn(),
  compact: false,
  inline: false,
  additionalControl: (
    <input type="button" data-test="mock-text-aditional-control" />
  ),
};

test('should render', () => {
  const { container } = render(<Field {...defaultProps} />);
  expect(container).toBeInTheDocument();
});
test('should render with aditional control', () => {
  const { getByTestId } = render(<Field {...defaultProps} />);
  const additionalControl = getByTestId('mock-text-aditional-control');
  expect(additionalControl).toBeInTheDocument();
});
test('should call onChange', () => {
  const { getByTestId } = render(<Field {...defaultProps} />);
  const textArea = getByTestId('mock-text-control');
  fireEvent.change(textArea, { target: { value: 'x' } });
  expect(defaultProps.onChange).toHaveBeenCalled();
});

test('should render compact', () => {
  render(<Field {...defaultProps} compact />);
  expect(screen.queryByText(defaultProps.description)).not.toBeInTheDocument();
});
test('shiuld render error message', () => {
  const { getByText } = render(
    <Field {...defaultProps} errorMessage="error message" />,
  );
  expect(getByText('error message')).toBeInTheDocument();
});
