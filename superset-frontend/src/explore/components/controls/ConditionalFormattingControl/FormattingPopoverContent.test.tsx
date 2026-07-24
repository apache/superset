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
  userEvent,
} from 'spec/helpers/testing-library';
import { Comparator, ColorSchemeEnum } from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/common';
import { FormattingPopoverContent } from './FormattingPopoverContent';

const mockOnChange = jest.fn();

const columns = [
  { label: 'Column 1', value: 'column1', dataType: GenericDataType.Numeric },
  { label: 'Column 2', value: 'column2', dataType: GenericDataType.Numeric },
];

const columnsStringType = [
  { label: 'Column 1', value: 'column1', dataType: GenericDataType.String },
  { label: 'Column 2', value: 'column2', dataType: GenericDataType.String },
];

const columnsBooleanType = [
  { label: 'Column 1', value: 'column1', dataType: GenericDataType.Boolean },
  { label: 'Column 2', value: 'column2', dataType: GenericDataType.Boolean },
];

const mixColumns = [
  { label: 'Name', value: 'name', dataType: GenericDataType.String },
  { label: 'Sales', value: 'sales', dataType: GenericDataType.Numeric },
  { label: 'Active', value: 'active', dataType: GenericDataType.Boolean },
];

const extraColorChoices = [
  {
    label: 'Colors',
    colors: [ColorSchemeEnum.Green, ColorSchemeEnum.Red],
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
  expect(screen.getAllByText('Color scheme')).toHaveLength(1);
  expect(screen.getAllByText('Operator')).toHaveLength(1);
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
  const { container } = render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const colorPickerTrigger = container.querySelector(
    '.ant-color-picker-trigger',
  );
  expect(colorPickerTrigger).toBeInTheDocument();
  await userEvent.click(colorPickerTrigger!);

  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-items'),
    ).toBeInTheDocument();
  });

  const presets = document.querySelectorAll('.ant-color-picker-presets-color');
  const greenPreset = presets[0];

  expect(greenPreset).toBeInTheDocument();
  await userEvent.click(greenPreset);

  // Assert that the operator is set to 'None'
  expect(screen.getByText(/none/i)).toBeInTheDocument();
});

test('displays the correct input fields based on the selected string type operator', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columnsStringType}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.BeginsWith },
  });
  fireEvent.click(await screen.findByTitle('begins with'));
  expect(await screen.findByLabelText('Target value')).toBeInTheDocument();
});

test('does not display the input fields when selected a boolean type operator', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columnsBooleanType}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.IsTrue },
  });
  fireEvent.click(await screen.findByTitle('is true'));
  expect(await screen.queryByLabelText('Target value')).toBeNull();
});

test('displays Use gradient checkbox', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      allColumns={columns}
    />,
  );

  expect(screen.getByText('Use gradient')).toBeInTheDocument();
});

// Helper function to find the "Use gradient" checkbox
// The checkbox and text are in sibling columns within the same row
const findUseGradientCheckbox = (): HTMLInputElement => {
  const useGradientText = screen.getByText('Use gradient');
  // Find the common parent row that contains both the text and checkbox
  let rowElement: HTMLElement | null = useGradientText.parentElement;
  while (rowElement) {
    const checkbox = rowElement.querySelector('input[type="checkbox"]');
    if (checkbox && rowElement.textContent?.includes('Use gradient')) {
      return checkbox as HTMLInputElement;
    }
    rowElement = rowElement.parentElement;
  }
  throw new Error('Could not find Use gradient checkbox');
};

test('Use gradient checkbox defaults to checked', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      allColumns={columns}
    />,
  );

  const checkbox = findUseGradientCheckbox();
  expect(checkbox).toBeChecked();
});

test('Use gradient checkbox can be toggled', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      allColumns={columns}
    />,
  );

  const checkbox = findUseGradientCheckbox();
  expect(checkbox).toBeChecked();

  // Uncheck the checkbox
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();

  // Check the checkbox again
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
});

test('The Use Gradient check box is not displayed for string and boolean and is displayed for numeric data types.', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columnsStringType}
      allColumns={columnsStringType}
    />,
  );

  expect(screen.queryByText('Use gradient')).not.toBeInTheDocument();

  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columnsBooleanType}
      allColumns={columnsBooleanType}
    />,
  );

  expect(screen.queryByText('Use gradient')).not.toBeInTheDocument();

  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      allColumns={columns}
    />,
  );

  expect(screen.queryByText('Use gradient')).toBeInTheDocument();
});

test('should display formatting column and object fields when allColumns is provided and non-empty', async () => {
  render(
    <FormattingPopoverContent
      columns={mixColumns}
      allColumns={mixColumns}
      onChange={mockOnChange}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('Formatting column')).toBeInTheDocument();
    expect(screen.getByText('Formatting object')).toBeInTheDocument();
  });
});

test('should hide formatting fields when allColumns is empty', async () => {
  render(
    <FormattingPopoverContent
      columns={mixColumns}
      allColumns={[]}
      onChange={mockOnChange}
    />,
  );

  await waitFor(() => {
    expect(screen.queryByText('Formatting column')).not.toBeInTheDocument();
    expect(screen.queryByText('Formatting object')).not.toBeInTheDocument();
  });
});

test('should hide formatting fields when color scheme is Green', async () => {
  render(
    <FormattingPopoverContent
      config={{ colorScheme: extraColorChoices[0].colors[0] }}
      columns={mixColumns}
      allColumns={mixColumns}
      onChange={mockOnChange}
    />,
  );

  await waitFor(() => {
    expect(screen.queryByText('Formatting column')).not.toBeInTheDocument();
    expect(screen.queryByText('Formatting object')).not.toBeInTheDocument();
  });
});
