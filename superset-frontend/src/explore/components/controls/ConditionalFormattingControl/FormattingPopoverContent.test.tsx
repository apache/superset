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
  within,
} from 'spec/helpers/testing-library';
import tinycolor from 'tinycolor2';
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

// This form uses `requiredMark="optional"`, so antd appends a literal
// "(optional)" suffix inside the <label> of any non-required field (see
// antd's FormItemLabel.js). Min bound/Max bound are intentionally optional,
// so every label query for them — positive or negative — needs `exact: false`
// to match regardless of that suffix.
const boundLabelOptions = { exact: false };

const getBoundInputs = () => ({
  minBoundInput: screen.getByLabelText('Min bound', boundLabelOptions),
  maxBoundInput: screen.getByLabelText('Max bound', boundLabelOptions),
});

// The shared `selectOption` helper (spec/helpers/testing-library) resolves
// the open dropdown via `document.querySelector('.ant-select-dropdown-list')`
// -- the first match anywhere in the document -- which is safe only when a
// test opens a single Select. This `Select` (from `@superset-ui/core/components`)
// renders its popup through `getPopupContainer={trigger => trigger.parentNode}`
// (inline, as a sibling of the trigger, rather than portaled to <body>), and
// antd never removes a closed dropdown's list node afterward. Because "Bound
// unit" sits earlier in the DOM than "Percent denominator", opening "Bound
// unit" once leaves a stale, closed dropdown list that permanently wins any
// *unscoped* "first match" query -- a later interaction with "Percent
// denominator" via the shared helper would silently re-read "Bound unit"'s
// stale list and time out looking for an option that was never there.
// Scope explicitly to the target Select's own popup container (its trigger's
// parent) to sidestep that.
const selectFieldOption = async (option: string, selectName: string) => {
  const trigger = await screen.findByRole('combobox', { name: selectName });
  const container = trigger.closest('.ant-select')!
    .parentElement as HTMLElement;
  await userEvent.click(trigger);
  const item = await within(container).findByText(option);
  await userEvent.click(item);
};

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
  expect(screen.getByLabelText('Color scheme')).toBeInTheDocument();
  expect(screen.getByLabelText('Operator')).toBeInTheDocument();
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
  const greenPreset = Array.from(presets).find(preset => {
    const inner = preset.querySelector('.ant-color-picker-color-block-inner');
    return (
      inner && inner.getAttribute('style')?.includes('rgba(0, 150, 0, 0.2)')
    );
  });

  expect(greenPreset).toBeDefined();
  expect(greenPreset).toBeInTheDocument();
  const safeGreenPreset = greenPreset as HTMLElement;

  const innerColorBlock = safeGreenPreset.querySelector(
    '.ant-color-picker-color-block-inner',
  );
  expect(innerColorBlock).toHaveStyle({ background: 'rgba(0, 150, 0, 0.2)' });

  expect(safeGreenPreset).toBeInTheDocument();
  await userEvent.click(safeGreenPreset);

  const operatorInput = screen.getByLabelText('Operator');
  expect(operatorInput).toBeInTheDocument();

  const operatorSelect = operatorInput.closest('.ant-select-content');
  expect(operatorSelect).toBeInTheDocument();
  expect(operatorSelect).toHaveTextContent(/none/i);
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

test('should not display tooltip when extraColorChoices is not provided', async () => {
  render(
    <FormattingPopoverContent onChange={mockOnChange} columns={columns} />,
  );

  const colorSchemeFormItem = screen
    .getByText('Color scheme')
    .closest('.ant-form-item');
  expect(colorSchemeFormItem).toBeInTheDocument();
  const tooltipIcon = colorSchemeFormItem?.querySelector(
    '.ant-form-item-tooltip',
  );
  expect(tooltipIcon).not.toBeInTheDocument();
});

test('should display tooltip icon when extraColorChoices is provided', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const colorSchemeFormItem = screen
    .getByText('Color scheme')
    .closest('.ant-form-item');
  expect(colorSchemeFormItem).toBeInTheDocument();

  const tooltipIcon = colorSchemeFormItem?.querySelector(
    '.ant-form-item-tooltip',
  );
  expect(tooltipIcon).toBeInTheDocument();

  const questionIcon = tooltipIcon?.querySelector(
    '[aria-label="question-circle"]',
  );
  expect(questionIcon).toBeInTheDocument();
});

test('should not display tooltip icon when extraColorChoices is empty', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={[]}
    />,
  );

  const colorSchemeFormItem = screen
    .getByText('Color scheme')
    .closest('.ant-form-item');
  expect(colorSchemeFormItem).toBeInTheDocument();
  const tooltipIcon = colorSchemeFormItem?.querySelector(
    '.ant-form-item-tooltip',
  );
  expect(tooltipIcon).not.toBeInTheDocument();
});

test('shows min/max bound fields for the default None operator on a numeric column', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const { minBoundInput, maxBoundInput } = getBoundInputs();
  expect(minBoundInput).toBeInTheDocument();
  expect(maxBoundInput).toBeInTheDocument();
});

test('shows only the Max bound field when a greater-than operator is selected', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.GreaterThan },
  });
  fireEvent.click(await screen.findByTitle('>'));

  expect(await screen.findByLabelText('Target value')).toBeInTheDocument();
  // getColorFunction only reads maxBound for `>`, so minBound is not
  // user-facing (and would have no effect) for this operator.
  expect(
    screen.getByLabelText('Max bound', boundLabelOptions),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText('Min bound', boundLabelOptions),
  ).not.toBeInTheDocument();
});

test('shows only the Min bound field when a less-than operator is selected', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.LessThan },
  });
  fireEvent.click(await screen.findByTitle('<'));

  expect(await screen.findByLabelText('Target value')).toBeInTheDocument();
  // getColorFunction only reads minBound for `<`, so maxBound is not
  // user-facing (and would have no effect) for this operator.
  expect(
    screen.getByLabelText('Min bound', boundLabelOptions),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText('Max bound', boundLabelOptions),
  ).not.toBeInTheDocument();
});

test('hides min/max bound fields for operators that already take two values', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.Between },
  });
  fireEvent.click(await screen.findByTitle('< x <'));

  expect(await screen.findByLabelText('Left value')).toBeInTheDocument();
  expect(
    screen.queryByLabelText('Min bound', boundLabelOptions),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText('Max bound', boundLabelOptions),
  ).not.toBeInTheDocument();
});

test('hides min/max bound fields on string columns', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columnsStringType}
      extraColorChoices={extraColorChoices}
    />,
  );

  expect(
    screen.queryByLabelText('Min bound', boundLabelOptions),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText('Max bound', boundLabelOptions),
  ).not.toBeInTheDocument();
});

test('shows no validation error for a valid min/max bound pair', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const { minBoundInput, maxBoundInput } = getBoundInputs();

  await userEvent.type(minBoundInput, '5');
  fireEvent.blur(minBoundInput);
  await userEvent.type(maxBoundInput, '10');
  fireEvent.blur(maxBoundInput);
  fireEvent.blur(minBoundInput);

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });

  expect(
    screen.queryByText('Min bound should be smaller than max bound'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Max bound should be greater than min bound'),
  ).not.toBeInTheDocument();
});

test('shows a validation error when min bound is greater than max bound', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const { minBoundInput, maxBoundInput } = getBoundInputs();

  await userEvent.type(minBoundInput, '10');
  fireEvent.blur(minBoundInput);
  await userEvent.type(maxBoundInput, '5');
  fireEvent.blur(maxBoundInput);
  fireEvent.blur(minBoundInput);

  expect(
    await screen.findByText('Min bound should be smaller than max bound'),
  ).toBeInTheDocument();
  expect(
    await screen.findByText('Max bound should be greater than min bound'),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByText('Apply'));
  expect(onChange).not.toHaveBeenCalled();
});

test('submits typed minBound/maxBound values to onChange with the correct field names', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const { minBoundInput, maxBoundInput } = getBoundInputs();

  await userEvent.type(minBoundInput, '5');
  fireEvent.blur(minBoundInput);
  await userEvent.type(maxBoundInput, '10');
  fireEvent.blur(maxBoundInput);

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });

  const lastCallPayload = onChange.mock.calls[0][0];
  expect(lastCallPayload.minBound).toBe(5);
  expect(lastCallPayload.maxBound).toBe(10);
});

test('clearing optional bounds restores undefined values', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      config={{
        column: 'column1',
        operator: Comparator.None,
        colorScheme: '#FF0000',
        minBound: 5,
        maxBound: 10,
      }}
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const { minBoundInput, maxBoundInput } = getBoundInputs();
  await userEvent.clear(minBoundInput);
  fireEvent.blur(minBoundInput);
  await userEvent.clear(maxBoundInput);
  fireEvent.blur(maxBoundInput);

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });
  expect(onChange.mock.calls[0][0].minBound).toBeUndefined();
  expect(onChange.mock.calls[0][0].maxBound).toBeUndefined();
});

test('requires max bound to be greater than a greater-than target', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.GreaterThan },
  });
  fireEvent.click(await screen.findByTitle('>'));

  const targetInput = await screen.findByLabelText('Target value');
  const maxBoundInput = screen.getByLabelText('Max bound', boundLabelOptions);
  await userEvent.type(targetInput, '100');
  await userEvent.type(maxBoundInput, '90');
  fireEvent.blur(maxBoundInput);

  expect(
    await screen.findByText('Max bound should be greater than target value'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText('Apply'));
  expect(onChange).not.toHaveBeenCalled();
});

test('requires min bound to be smaller than a less-than target', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.LessThan },
  });
  fireEvent.click(await screen.findByTitle('<'));

  const targetInput = await screen.findByLabelText('Target value');
  const minBoundInput = screen.getByLabelText('Min bound', boundLabelOptions);
  await userEvent.type(targetInput, '100');
  await userEvent.type(minBoundInput, '110');
  fireEvent.blur(minBoundInput);

  expect(
    await screen.findByText('Min bound should be smaller than target value'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText('Apply'));
  expect(onChange).not.toHaveBeenCalled();
});

test('does not compare a percentage max bound directly with an absolute target', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  await selectFieldOption('>', 'Operator');
  await userEvent.type(await screen.findByLabelText('Target value'), '1000');
  await selectFieldOption('% of column', 'Bound unit');
  const maxBoundInput = screen.getByLabelText('Max bound', boundLabelOptions);
  await userEvent.type(maxBoundInput, '100');
  fireEvent.blur(maxBoundInput);

  expect(
    screen.queryByText('Max bound should be greater than target value'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Apply'));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
});

test('does not compare a percentage min bound directly with an absolute target', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  await selectFieldOption('<', 'Operator');
  await userEvent.type(await screen.findByLabelText('Target value'), '-1000');
  await selectFieldOption('% of column', 'Bound unit');
  const minBoundInput = screen.getByLabelText('Min bound', boundLabelOptions);
  await userEvent.type(minBoundInput, '100');
  fireEvent.blur(minBoundInput);

  expect(
    screen.queryByText('Min bound should be smaller than target value'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Apply'));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
});

test('shows Center value and Low/Mid/High color fields for the default None operator on a numeric column', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  expect(
    screen.getByLabelText('Center value', boundLabelOptions),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Low color')).toBeInTheDocument();
  expect(screen.getByLabelText('Mid color')).toBeInTheDocument();
  expect(screen.getByLabelText('High color')).toBeInTheDocument();
});

test('hides Center value and Low/Mid/High color fields for a boundable directional operator', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.change(screen.getAllByLabelText('Operator')[0], {
    target: { value: Comparator.GreaterThan },
  });
  fireEvent.click(await screen.findByTitle('>'));

  expect(await screen.findByLabelText('Target value')).toBeInTheDocument();
  expect(
    screen.queryByLabelText('Center value', boundLabelOptions),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Low color')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Mid color')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('High color')).not.toBeInTheDocument();
});

test('hides Center value and color fields on string columns', () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columnsStringType}
      extraColorChoices={extraColorChoices}
    />,
  );

  expect(
    screen.queryByLabelText('Center value', boundLabelOptions),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Low color')).not.toBeInTheDocument();
});

test.each([
  [10, 'Center value should be greater than min bound'],
  [40, 'Center value should be smaller than max bound'],
])(
  'rejects Center value %s when it equals a bound',
  async (centerValue, expectedError) => {
    const onChange = jest.fn();
    render(
      <FormattingPopoverContent
        onChange={onChange}
        columns={columns}
        extraColorChoices={extraColorChoices}
      />,
    );

    const { minBoundInput, maxBoundInput } = getBoundInputs();
    await userEvent.type(minBoundInput, '10');
    fireEvent.blur(minBoundInput);
    await userEvent.type(maxBoundInput, '40');
    fireEvent.blur(maxBoundInput);

    const centerValueInput = screen.getByLabelText(
      'Center value',
      boundLabelOptions,
    );
    await userEvent.type(centerValueInput, String(centerValue));
    fireEvent.blur(centerValueInput);
    fireEvent.click(screen.getByText('Apply'));

    expect(await screen.findByText(expectedError)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  },
);

test('validates Center value against Min bound and Max bound when both are set', async () => {
  render(
    <FormattingPopoverContent
      onChange={mockOnChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  const { minBoundInput, maxBoundInput } = getBoundInputs();
  await userEvent.type(minBoundInput, '0');
  fireEvent.blur(minBoundInput);
  await userEvent.type(maxBoundInput, '100');
  fireEvent.blur(maxBoundInput);

  const centerValueInput = screen.getByLabelText(
    'Center value',
    boundLabelOptions,
  );
  await userEvent.type(centerValueInput, '150');
  fireEvent.blur(centerValueInput);

  expect(
    await screen.findByText('Center value should be smaller than max bound'),
  ).toBeInTheDocument();
});

// Opens the given ColorPickerControl's popover, clicks the preset swatch at
// `presetIndex`, and returns the hex color that swatch actually represents
// (read from its own inline `style.background`, normalized via `tinycolor`
// so it's comparable to the hex string ColorPickerControl's
// `outputFormat="hex"` produces). Returning the *actual* clicked color
// (rather than just asserting "some string came back") lets the caller
// verify each of the three fields resolved to the swatch it was individually
// told to click, not merely that all three happened to end up non-empty.
// The `ariaLabel` prop on ColorPickerControl lands directly on the
// `.ant-color-picker-trigger` element (see ColorTrigger in antd), so
// `getByLabelText` resolves the correct trigger among the several color
// pickers rendered in this form without any extra scoping.
//
// Each picker's popover stays mounted (unclosed) after a swatch is picked,
// so with three pickers on the page there can be more than one
// `.ant-color-picker-presets-items` panel present at once by the time this
// runs a second or third time. Rather than a plain `querySelector` (which
// would grab whichever panel happens to be first in the DOM — possibly a
// stale one from an earlier pick), wait for the panel *count* to grow past
// what it was before this trigger was clicked, then act on the newest
// (last) panel, which is the one this click just opened.
const pickPresetColorAt = async (label: string, presetIndex: number) => {
  const panelSelector = '.ant-color-picker-presets-items';
  const panelCountBefore = document.querySelectorAll(panelSelector).length;

  const trigger = screen.getByLabelText(label);
  expect(trigger).toHaveClass('ant-color-picker-trigger');
  await userEvent.click(trigger);

  await waitFor(() => {
    expect(document.querySelectorAll(panelSelector).length).toBeGreaterThan(
      panelCountBefore,
    );
  });

  const panels = document.querySelectorAll(panelSelector);
  const newestPanel = panels[panels.length - 1];
  const presets = newestPanel.querySelectorAll(
    '.ant-color-picker-presets-color',
  );
  const preset = presets[presetIndex] as HTMLElement;
  expect(preset).toBeInTheDocument();

  const swatch = preset.querySelector(
    '.ant-color-picker-color-block-inner',
  ) as HTMLElement;
  expect(swatch).toBeInTheDocument();
  const clickedColor = tinycolor(swatch.style.background).toHexString();

  await userEvent.click(preset);
  return clickedColor;
};

test('selecting Low/Mid/High colors submits the exact colors clicked to onChange, independently per field', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  // Distinct preset indices per field are the whole point of this test: it
  // proves the three fields wire independently, not merely that each ends
  // up holding some string (which selecting the same swatch three times
  // would also satisfy).
  const lowExpected = await pickPresetColorAt('Low color', 0);
  const midExpected = await pickPresetColorAt('Mid color', 1);
  const highExpected = await pickPresetColorAt('High color', 2);

  // Sanity check: if the default categorical scheme ever collapsed to fewer
  // distinct colors, the assertions below could pass vacuously.
  expect(new Set([lowExpected, midExpected, highExpected]).size).toBe(3);

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });

  const payload = onChange.mock.calls[0][0];
  expect(tinycolor(payload.lowColor).toHexString()).toEqual(lowExpected);
  expect(tinycolor(payload.midColor).toHexString()).toEqual(midExpected);
  expect(tinycolor(payload.highColor).toHexString()).toEqual(highExpected);
});

test('keeps Use gradient available for complete diverging configs', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      allColumns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  expect(screen.getByText('Use gradient')).toBeInTheDocument();

  const centerValueInput = screen.getByLabelText(
    'Center value',
    boundLabelOptions,
  );
  await userEvent.type(centerValueInput, '50');
  fireEvent.blur(centerValueInput);

  await pickPresetColorAt('Low color', 0);
  await pickPresetColorAt('Mid color', 1);
  await pickPresetColorAt('High color', 2);

  const gradientCheckbox = screen.getByRole('checkbox');
  expect(screen.getByText('Use gradient')).toBeInTheDocument();
  await userEvent.click(gradientCheckbox);
  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange.mock.calls[0][0].useGradient).toBe(false);
});

test('shows the percent denominator select only when Bound unit is set to percent, for both None and a directional operator', async () => {
  const { rerender } = render(
    <FormattingPopoverContent
      onChange={jest.fn()}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  expect(screen.getByLabelText('Bound unit')).toBeInTheDocument();
  expect(
    screen.queryByLabelText('Percent denominator'),
  ).not.toBeInTheDocument();

  await selectFieldOption('% of column', 'Bound unit');
  expect(screen.getByLabelText('Percent denominator')).toBeInTheDocument();

  await selectFieldOption('Value', 'Bound unit');
  expect(
    screen.queryByLabelText('Percent denominator'),
  ).not.toBeInTheDocument();

  // Also present for a directional operator (only Max bound shows for '>',
  // per getBoundVisibility) -- Bound unit isn't None-specific.
  await selectFieldOption('>', 'Operator');
  expect(screen.getByLabelText('Bound unit')).toBeInTheDocument();

  rerender(
    <FormattingPopoverContent
      onChange={jest.fn()}
      columns={columnsStringType}
      extraColorChoices={extraColorChoices}
    />,
  );
  // String columns never show bound fields, so Bound unit must not appear.
  expect(screen.queryByLabelText('Bound unit')).not.toBeInTheDocument();
});

test('submits boundUnit and percentDenominator to onChange with the correct field names', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  await selectFieldOption('% of column', 'Bound unit');
  await selectFieldOption('Column sum', 'Percent denominator');

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });

  const payload = onChange.mock.calls[0][0];
  expect(payload.boundUnit).toBe('percent');
  expect(payload.percentDenominator).toBe('sum');
});

test('defaults percentDenominator to Column max once switched to percent mode without picking one', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  await selectFieldOption('% of column', 'Bound unit');

  // Left untouched, the select must show the same explicit default used by
  // getColorFunction rather than an ambiguous blank state.
  expect(screen.getByText('Column max')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });

  const payload = onChange.mock.calls[0][0];
  expect(payload.percentDenominator).toBe('max');
});

test('defaults to Value and Column max when never touched', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
    />,
  );

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });

  const payload = onChange.mock.calls[0][0];
  expect(payload.boundUnit).toBe('value');
  expect(payload.percentDenominator).toBeUndefined();
});

test('disables the % of column option when serverPagination is true', async () => {
  const onChange = jest.fn();
  render(
    <FormattingPopoverContent
      onChange={onChange}
      columns={columns}
      extraColorChoices={extraColorChoices}
      serverPagination
    />,
  );

  const trigger = await screen.findByRole('combobox', { name: 'Bound unit' });
  await userEvent.click(trigger);
  const option = await screen.findByText('% of column');
  await userEvent.click(option);

  // The disabled option must not be selected: the denominator select stays
  // hidden and the submitted config keeps Bound unit at its Value default.
  expect(
    screen.queryByLabelText('Percent denominator'),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Apply'));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });

  expect(onChange.mock.calls[0][0].boundUnit).toBe('value');
});
