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
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { Comparator } from '@superset-ui/chart-controls';
import { ColorSchemeEnum } from '@superset-ui/plugin-chart-table';
import { FormattingPopoverContent } from './FormattingPopoverContent';

const mockOnChange = jest.fn();

const columns = [
  { label: 'Column 1', value: 'column1' },
  { label: 'Column 2', value: 'column2' },
];

const extraColorChoices = [
  {
    value: ColorSchemeEnum.Green,
    label: 'Green for increase, red for decrease',
  },
  {
    value: ColorSchemeEnum.Red,
    label: 'Red for increase, green for decrease',
  },
];

test('renders FormattingPopoverContent component', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  // Assert that the component renders correctly
  expect(screen.getByLabelText('Column')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Color scheme')).toHaveLength(2);
  expect(screen.getAllByLabelText('Operator')).toHaveLength(2);
  expect(screen.queryByLabelText('Left value')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Right value')).not.toBeInTheDocument();
  expect(screen.getByText('Apply')).toBeInTheDocument();
});

test('calls onChange when Apply button is clicked', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  // Simulate user interaction by clicking the Apply button
  fireEvent.click(screen.getByText('Apply'));

  // Assert that the onChange function is called with the correct config
  await waitFor(() => {
    expect(mockOnChange).toHaveBeenCalled();
  });
});

test('renders the correct input fields based on the selected operator', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  // Select the 'Between' operator
  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.Between },
  });
  fireEvent.click(await screen.findByTitle('< x <'));

  // Assert that the left and right value inputs are rendered
  expect(await screen.findByLabelText('Left value')).toBeInTheDocument();
  expect(await screen.findByLabelText('Right value')).toBeInTheDocument();
});

test('renders None for operator when Green for increase is selected', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  // Select the 'Green for increase' color scheme
  fireEvent.change(screen.getAllByLabelText(/color scheme/i)[0], {
    target: { value: ColorSchemeEnum.Green },
  });

  fireEvent.click(await screen.findByTitle(/green for increase/i));

  // Assert that the operator is set to 'None'
  expect(screen.getByText(/none/i)).toBeInTheDocument();
});
