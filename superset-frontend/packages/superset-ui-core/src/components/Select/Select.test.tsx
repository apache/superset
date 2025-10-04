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
  createEvent,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@superset-ui/core/spec';
import { Select } from '.';

type Option = {
  label: string;
  value: number;
  gender: string;
  disabled?: boolean;
};

const ARIA_LABEL = 'Test';
const NEW_OPTION = 'Kyle';
const NO_DATA = 'No data';
const LOADING = 'Loading...';
const OPTIONS: Option[] = [
  { label: 'John', value: 1, gender: 'Male' },
  { label: 'Liam', value: 2, gender: 'Male' },
  { label: 'Olivia', value: 3, gender: 'Female' },
  { label: 'Emma', value: 4, gender: 'Female' },
  { label: 'Noah', value: 5, gender: 'Male' },
  { label: 'Ava', value: 6, gender: 'Female' },
  { label: 'Oliver', value: 7, gender: 'Male' },
  { label: 'ElijahH', value: 8, gender: 'Male' },
  { label: 'Charlotte', value: 9, gender: 'Female' },
  { label: 'Giovanni', value: 10, gender: 'Male' },
  { label: 'Franco', value: 11, gender: 'Male' },
  { label: 'Sandro', value: 12, gender: 'Male' },
  { label: 'Alehandro', value: 13, gender: 'Male' },
  { label: 'Johnny', value: 14, gender: 'Male' },
  { label: 'Nikole', value: 15, gender: 'Female' },
  { label: 'Igor', value: 16, gender: 'Male' },
  { label: 'Guilherme', value: 17, gender: 'Male' },
  { label: 'Irfan', value: 18, gender: 'Male' },
  { label: 'George', value: 19, gender: 'Male' },
  { label: 'Ashfaq', value: 20, gender: 'Male' },
  { label: 'Herme', value: 21, gender: 'Male' },
  { label: 'Cher', value: 22, gender: 'Female' },
  { label: 'Her', value: 23, gender: 'Male' },
].sort((option1, option2) => option1.label.localeCompare(option2.label));
const NULL_OPTION = { label: '<NULL>', value: null } as unknown as {
  label: string;
  value: number;
};

const defaultProps = {
  allowClear: true,
  ariaLabel: ARIA_LABEL,
  labelInValue: true,
  options: OPTIONS,
  showSearch: true,
};

const getElementByClassName = (className: string) =>
  document.querySelector(className)! as HTMLElement;

const getElementsByClassName = (className: string) =>
  document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

const getSelect = () =>
  screen.getByRole('combobox', { name: new RegExp(ARIA_LABEL, 'i') });

const selectAllButtonText = (length: number) => `Select all (${length})`;
const deselectAllButtonText = (length: number) => `Deselect all (${length})`;

const findSelectOption = (text: string) =>
  waitFor(() =>
    within(getElementByClassName('.rc-virtual-list')).getByText(text),
  );

const querySelectOption = (text: string) =>
  waitFor(() =>
    within(getElementByClassName('.rc-virtual-list')).queryByText(text),
  );

const getAllSelectOptions = () =>
  getElementsByClassName('.ant-select-item-option-content');

const findAllSelectOptions = () =>
  waitFor(() => getElementsByClassName('.ant-select-item-option-content'));

const findSelectValue = () =>
  waitFor(() => getElementByClassName('.ant-select-selection-item'));

const findAllSelectValues = () =>
  waitFor(() => [...getElementsByClassName('.ant-select-selection-item')]);

const clearAll = () => userEvent.click(screen.getByLabelText('close-circle'));

const matchOrder = async (expectedLabels: string[]) => {
  const actualLabels: string[] = [];
  (await findAllSelectOptions()).forEach(option => {
    actualLabels.push(option.textContent || '');
  });
  // menu is a virtual list, which means it may not render all options
  expect(actualLabels.slice(0, expectedLabels.length)).toEqual(
    expectedLabels.slice(0, actualLabels.length),
  );
  return true;
};

const type = async (text: string, delay?: number, clear = true) => {
  const select = getSelect();
  if (clear) {
    await userEvent.clear(select);
  }
  return userEvent.type(select, text, { delay: delay ?? 10 });
};

const clearTypedText = async () => {
  const select = getSelect();
  await userEvent.clear(select);
};

const open = () => waitFor(() => userEvent.click(getSelect()));

const reopen = async () => {
  await type('{esc}');
  await open();
};

test('displays a header', async () => {
  const headerText = 'Header';
  render(<Select {...defaultProps} header={headerText} />);
  expect(screen.getByText(headerText)).toBeInTheDocument();
});

test('adds a new option if the value is not in the options, when options are empty', async () => {
  render(<Select {...defaultProps} options={[]} value={OPTIONS[0]} />);
  await open();
  expect(await findSelectOption(OPTIONS[0].label)).toBeInTheDocument();
  const options = await findAllSelectOptions();
  expect(options).toHaveLength(1);
  options.forEach((option, i) =>
    expect(option).toHaveTextContent(OPTIONS[i].label),
  );
});

test('adds a new option if the value is not in the options, when options have values', async () => {
  render(
    <Select {...defaultProps} options={[OPTIONS[1]]} value={OPTIONS[0]} />,
  );
  await open();
  expect(await findSelectOption(OPTIONS[0].label)).toBeInTheDocument();
  expect(await findSelectOption(OPTIONS[1].label)).toBeInTheDocument();
  const options = await findAllSelectOptions();
  expect(options).toHaveLength(2);
  options.forEach((option, i) =>
    expect(option).toHaveTextContent(OPTIONS[i].label),
  );
});

test('does not add a new option if the value is already in the options', async () => {
  render(
    <Select {...defaultProps} options={[OPTIONS[0]]} value={OPTIONS[0]} />,
  );
  await open();
  expect(await findSelectOption(OPTIONS[0].label)).toBeInTheDocument();
  const options = await findAllSelectOptions();
  expect(options).toHaveLength(1);
});

test('does not add new options when the value is in a nested/grouped option', async () => {
  const options = [
    {
      label: 'Group',
      options: [OPTIONS[0]],
    },
  ];
  render(<Select {...defaultProps} options={options} value={OPTIONS[0]} />);
  await open();
  expect(await findSelectOption(OPTIONS[0].label)).toBeInTheDocument();
  const selectOptions = await findAllSelectOptions();
  expect(selectOptions).toHaveLength(1);
});

test('inverts the selection', async () => {
  render(<Select {...defaultProps} invertSelection />);
  await open();
  await userEvent.click(await findSelectOption(OPTIONS[0].label));
  expect(await screen.findByLabelText('stop')).toBeInTheDocument();
});

test('sort the options by label if no sort comparator is provided', async () => {
  const unsortedOptions = [...OPTIONS].sort(() => Math.random());
  render(<Select {...defaultProps} options={unsortedOptions} />);
  await open();
  const options = await findAllSelectOptions();
  options.forEach((option, key) =>
    expect(option).toHaveTextContent(OPTIONS[key].label),
  );
});

test('should sort selected to top when in single mode', async () => {
  render(<Select {...defaultProps} mode="single" />);
  const originalLabels = OPTIONS.map(option => option.label);
  await open();
  await userEvent.click(await findSelectOption(originalLabels[1]));
  // after selection, keep the original order
  expect(await matchOrder(originalLabels)).toBe(true);

  // order selected to top when reopen
  await reopen();
  let labels = originalLabels.slice();
  labels = labels.splice(1, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // keep clicking other items, the updated order should still based on
  // original order
  await userEvent.click(await findSelectOption(originalLabels[5]));
  await matchOrder(labels);
  await reopen();
  labels = originalLabels.slice();
  labels = labels.splice(5, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // should revert to original order
  await clearAll();
  await reopen();
  expect(await matchOrder(originalLabels)).toBe(true);
});

test('should sort selected to the top when in multi mode', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  const originalLabels = OPTIONS.map(option => option.label);
  let labels = originalLabels.slice();

  await open();
  await userEvent.click(await findSelectOption(labels[2]));
  expect(await matchOrder(labels)).toBe(true);

  await reopen();
  labels = labels.splice(2, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  await open();
  await userEvent.click(await findSelectOption(labels[5]));
  await reopen();
  labels = [labels.splice(0, 1)[0], labels.splice(4, 1)[0]].concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // should revert to original order
  await clearAll();
  await reopen();
  expect(await matchOrder(originalLabels)).toBe(true);
});

test('order of selected values is preserved until dropdown is closed', async () => {
  render(<Select {...defaultProps} mode="multiple" allowSelectAll={false} />);
  const originalLabels = OPTIONS.map(option => option.label);
  await open();
  await userEvent.click(await findSelectOption(originalLabels[1]));
  await userEvent.click(await findSelectOption(originalLabels[5]));
  expect(await matchOrder(originalLabels)).toBe(true);
});

test('searches for label or value', async () => {
  const option = OPTIONS[11];
  render(<Select {...defaultProps} />);
  const search = option.value;
  await type(search.toString());
  const options = await findAllSelectOptions();
  expect(options.length).toBe(1);
  expect(options[0]).toHaveTextContent(option.label);
});

test('search order exact and startWith match first', async () => {
  render(<Select {...defaultProps} />);
  await type('Her');
  await waitFor(() => {
    const options = getAllSelectOptions();
    expect(options.length).toBe(4);
    expect(options[0]?.textContent).toEqual('Her');
    expect(options[1]?.textContent).toEqual('Herme');
    expect(options[2]?.textContent).toEqual('Cher');
    expect(options[3]?.textContent).toEqual('Guilherme');
  });
});

test('ignores case when searching', async () => {
  render(<Select {...defaultProps} />);
  await type('george');
  expect(await findSelectOption('George')).toBeInTheDocument();
});

test('same case should be ranked to the top', async () => {
  render(
    <Select
      {...defaultProps}
      options={[
        { value: 'Cac' },
        { value: 'abac' },
        { value: 'acbc' },
        { value: 'CAc' },
      ]}
    />,
  );
  await type('Ac');
  await waitFor(() => {
    const options = getAllSelectOptions();
    expect(options.length).toBe(4);
    expect(options[0]?.textContent).toEqual('acbc');
    expect(options[1]?.textContent).toEqual('CAc');
    expect(options[2]?.textContent).toEqual('abac');
    expect(options[3]?.textContent).toEqual('Cac');
  });
});

test('ignores special keys when searching', async () => {
  render(<Select {...defaultProps} />);
  await type('{shift}');
  expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
});

test('searches for custom fields', async () => {
  render(<Select {...defaultProps} optionFilterProps={['label', 'gender']} />);
  await type('Liam');
  let options = await findAllSelectOptions();
  expect(options.length).toBe(1);
  expect(options[0]).toHaveTextContent('Liam');
  await type('Female');
  options = await findAllSelectOptions();
  expect(options.length).toBe(6);
  expect(options[0]).toHaveTextContent('Ava');
  expect(options[1]).toHaveTextContent('Charlotte');
  expect(options[2]).toHaveTextContent('Cher');
  expect(options[3]).toHaveTextContent('Emma');
  expect(options[4]).toHaveTextContent('Nikole');
  expect(options[5]).toHaveTextContent('Olivia');
  await type('1');
  expect(
    screen.getByText(NO_DATA, { selector: '.ant-empty-description' }),
  ).toBeInTheDocument();
});

test('removes duplicated values', async () => {
  render(<Select {...defaultProps} mode="multiple" allowNewOptions />);
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => 'a,b,b,b,c,d,d',
    },
  });
  fireEvent(input, paste);
  const values = await findAllSelectValues();
  expect(values.length).toBe(4);
  expect(values[0]).toHaveTextContent('a');
  expect(values[1]).toHaveTextContent('b');
  expect(values[2]).toHaveTextContent('c');
  expect(values[3]).toHaveTextContent('d');
});

test('renders a custom label', async () => {
  const options = [
    { value: 'John', label: <h1>John</h1> },
    { value: 'Liam', label: <h1>Liam</h1> },
    { value: 'Olivia', label: <h1>Olivia</h1> },
  ];
  render(<Select {...defaultProps} options={options} />);
  await open();
  expect(screen.getByRole('heading', { name: 'John' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Liam' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Olivia' })).toBeInTheDocument();
});

test('searches for a word with a custom label', async () => {
  const options = [
    { value: 'John', label: <h1>John</h1> },
    { value: 'Liam', label: <h1>Liam</h1> },
    { value: 'Olivia', label: <h1>Olivia</h1> },
  ];
  render(<Select {...defaultProps} options={options} />);
  await type('Liam');
  const selectOptions = await findAllSelectOptions();
  expect(selectOptions.length).toBe(1);
  expect(selectOptions[0]).toHaveTextContent('Liam');
});

test('removes a new option if the user does not select it', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  await type(NEW_OPTION);
  expect(await findSelectOption(NEW_OPTION)).toBeInTheDocument();
  await type('k');
  await waitFor(() =>
    expect(screen.queryByText(NEW_OPTION)).not.toBeInTheDocument(),
  );
});

test('clear all the values', async () => {
  const onClear = jest.fn();
  render(
    <Select
      {...defaultProps}
      mode="multiple"
      value={[OPTIONS[0], OPTIONS[1]]}
      onClear={onClear}
    />,
  );
  await clearAll();
  expect(onClear).toHaveBeenCalled();
  const values = await findAllSelectValues();
  expect(values.length).toBe(0);
});

test('does not add a new option if allowNewOptions is false', async () => {
  render(<Select {...defaultProps} options={OPTIONS} />);
  await open();
  await type(NEW_OPTION);
  expect(
    await screen.findByText(NO_DATA, { selector: '.ant-empty-description' }),
  ).toBeInTheDocument();
});

test('adds the null option when selected in single mode', async () => {
  render(<Select {...defaultProps} options={[OPTIONS[0], NULL_OPTION]} />);
  await open();
  await userEvent.click(await findSelectOption(NULL_OPTION.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(NULL_OPTION.label);
});

test('adds the null option when selected in multiple mode', async () => {
  render(
    <Select
      {...defaultProps}
      options={[OPTIONS[0], NULL_OPTION, OPTIONS[2]]}
      mode="multiple"
    />,
  );
  await open();
  await userEvent.click(await findSelectOption(OPTIONS[0].label));
  await userEvent.click(await findSelectOption(NULL_OPTION.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(OPTIONS[0].label);
  expect(values[1]).toHaveTextContent(NULL_OPTION.label);
});

test('renders the select with default props', () => {
  render(<Select {...defaultProps} />);
  expect(getSelect()).toBeInTheDocument();
});

test('opens the select without any data', async () => {
  render(<Select {...defaultProps} options={[]} />);
  await open();
  expect(
    screen.getByText(NO_DATA, { selector: '.ant-empty-description' }),
  ).toBeInTheDocument();
});

test('makes a selection in single mode', async () => {
  render(<Select {...defaultProps} />);
  const optionText = 'Emma';
  await open();
  await userEvent.click(await findSelectOption(optionText));
  expect(await findSelectValue()).toHaveTextContent(optionText);
});

test('multiple selections in multiple mode', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  await userEvent.click(await findSelectOption(firstOption.label));
  await userEvent.click(await findSelectOption(secondOption.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(firstOption.label);
  expect(values[1]).toHaveTextContent(secondOption.label);
});

test('changes the selected item in single mode', async () => {
  const onChange = jest.fn();
  render(<Select {...defaultProps} onChange={onChange} />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  await userEvent.click(await findSelectOption(firstOption.label));
  expect(await findSelectValue()).toHaveTextContent(firstOption.label);
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: firstOption.label,
      value: firstOption.value,
    }),
    expect.objectContaining(firstOption),
  );
  await userEvent.click(await findSelectOption(secondOption.label));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: secondOption.label,
      value: secondOption.value,
    }),
    expect.objectContaining(secondOption),
  );
  expect(await findSelectValue()).toHaveTextContent(secondOption.label);
});

test('deselects an item in multiple mode', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  await userEvent.click(await findSelectOption(firstOption.label));
  await userEvent.click(await findSelectOption(secondOption.label));
  let values = await findAllSelectValues();
  expect(values.length).toBe(2);
  expect(values[0]).toHaveTextContent(firstOption.label);
  expect(values[1]).toHaveTextContent(secondOption.label);
  await userEvent.click(await findSelectOption(firstOption.label));
  values = await findAllSelectValues();
  expect(values.length).toBe(1);
  expect(values[0]).toHaveTextContent(secondOption.label);
});

test('adds a new option if none is available and allowNewOptions is true', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  expect(await findSelectOption(NEW_OPTION)).toBeInTheDocument();
});

test('shows "No data" when allowNewOptions is false and a new option is entered', async () => {
  render(<Select {...defaultProps} allowNewOptions={false} />);
  await open();
  await type(NEW_OPTION);
  expect(
    await screen.findByText(NO_DATA, { selector: '.ant-empty-description' }),
  ).toBeInTheDocument();
});

test('does not show "No data" when allowNewOptions is true and a new option is entered', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  await waitFor(() =>
    expect(screen.queryByText(NO_DATA)).not.toBeInTheDocument(),
  );
});

test('does not show "Loading..." when allowNewOptions is false and a new option is entered', async () => {
  render(<Select {...defaultProps} allowNewOptions={false} />);
  await open();
  await type(NEW_OPTION);
  expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
});

test('does not add a new option if the option already exists', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  const option = OPTIONS[0].label;
  await open();
  await type(option);
  expect(await findSelectOption(option)).toBeInTheDocument();
});

test('sets a initial value in single mode', async () => {
  render(<Select {...defaultProps} value={OPTIONS[0]} />);
  expect(await findSelectValue()).toHaveTextContent(OPTIONS[0].label);
});

test('sets a initial value in multiple mode', async () => {
  render(
    <Select
      {...defaultProps}
      mode="multiple"
      value={[OPTIONS[0], OPTIONS[1]]}
    />,
  );
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(OPTIONS[0].label);
  expect(values[1]).toHaveTextContent(OPTIONS[1].label);
});

test('searches for an item', async () => {
  render(<Select {...defaultProps} />);
  const search = 'Oli';
  await type(search);
  const options = await findAllSelectOptions();
  expect(options.length).toBe(2);
  expect(options[0]).toHaveTextContent('Oliver');
  expect(options[1]).toHaveTextContent('Olivia');
});

test('triggers getPopupContainer if passed', async () => {
  const getPopupContainer = jest.fn();
  render(<Select {...defaultProps} getPopupContainer={getPopupContainer} />);
  await open();
  expect(getPopupContainer).toHaveBeenCalled();
});

test('does not render a helper text by default', async () => {
  render(<Select {...defaultProps} />);
  await open();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

test('renders a helper text when one is provided', async () => {
  const helperText = 'Helper text';
  render(<Select {...defaultProps} helperText={helperText} />);
  await open();
  expect(screen.getByRole('note')).toBeInTheDocument();
  expect(screen.queryByText(helperText)).toBeInTheDocument();
});

test('finds an element with a numeric value and does not duplicate the options', async () => {
  const options = [
    { label: 'a', value: 11 },
    { label: 'b', value: 12 },
  ];
  render(<Select {...defaultProps} options={options} allowNewOptions />);
  await open();
  await type('11');
  expect(await findSelectOption('a')).toBeInTheDocument();
  expect(await querySelectOption('11')).not.toBeInTheDocument();
});

test('render "Select all" for multi select', async () => {
  render(<Select {...defaultProps} mode="multiple" options={OPTIONS} />);
  await open();
  expect(
    await screen.findByText(selectAllButtonText(OPTIONS.length)),
  ).toBeInTheDocument();
});

test('does not render "Select all" for single select', async () => {
  render(<Select {...defaultProps} options={OPTIONS} mode="single" />);
  await open();
  expect(
    screen.queryByText(selectAllButtonText(OPTIONS.length)),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(selectAllButtonText(OPTIONS.length)),
  ).not.toBeInTheDocument();
});

test('does not render "Select all" for an empty multiple select', async () => {
  render(<Select {...defaultProps} options={[]} mode="multiple" />);
  await open();
  expect(
    screen.queryByText(selectAllButtonText(OPTIONS.length)),
  ).not.toBeInTheDocument();
});

test('Renders "Select all" when searching', async () => {
  render(<Select {...defaultProps} options={OPTIONS} mode="multiple" />);
  await open();
  await type('Select');
  await waitFor(() =>
    expect(
      screen.queryByText(selectAllButtonText(OPTIONS.length)),
    ).not.toBeInTheDocument(),
  );
});

test('selects all values', async () => {
  render(
    <Select
      {...defaultProps}
      options={OPTIONS}
      mode="multiple"
      maxTagCount={0}
    />,
  );
  await open();
  await userEvent.click(
    await screen.findByText(selectAllButtonText(OPTIONS.length)),
  );
  const values = await findAllSelectValues();
  expect(values.length).toBe(1);
  expect(values[0]).toHaveTextContent(`+ ${OPTIONS.length} ...`);
});

test('unselects all values', async () => {
  render(
    <Select
      {...defaultProps}
      options={OPTIONS}
      mode="multiple"
      maxTagCount={0}
    />,
  );
  await open();
  await userEvent.click(
    await screen.findByText(selectAllButtonText(OPTIONS.length)),
  );
  let values = await findAllSelectValues();
  expect(values.length).toBe(1);
  expect(values[0]).toHaveTextContent(`+ ${OPTIONS.length} ...`);
  await userEvent.click(
    await screen.findByText(deselectAllButtonText(OPTIONS.length)),
  );
  values = await findAllSelectValues();
  expect(values.length).toBe(0);
});

test('deselecting a new value also removes it from the options', async () => {
  render(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 10)}
      mode="multiple"
      allowNewOptions
    />,
  );
  await open();
  await type(NEW_OPTION);
  expect(await findSelectOption(NEW_OPTION)).toBeInTheDocument();
  await type('{enter}');
  clearTypedText();
  await userEvent.click(await findSelectOption(NEW_OPTION));
  expect(await querySelectOption(NEW_OPTION)).not.toBeInTheDocument();
});

test('Renders only 1 tag and an overflow tag in oneLine mode', () => {
  render(
    <Select
      {...defaultProps}
      value={[OPTIONS[0], OPTIONS[1], OPTIONS[2]]}
      mode="multiple"
      oneLine
    />,
  );
  expect(screen.getByText(OPTIONS[0].label)).toBeVisible();
  expect(screen.queryByText(OPTIONS[1].label)).not.toBeInTheDocument();
  expect(screen.queryByText(OPTIONS[2].label)).not.toBeInTheDocument();
  expect(screen.getByText('+ 2 ...')).toBeVisible();
});

test('Renders only an overflow tag if dropdown is open in oneLine mode', async () => {
  render(
    <Select
      {...defaultProps}
      value={[OPTIONS[0], OPTIONS[1], OPTIONS[2]]}
      mode="multiple"
      oneLine
    />,
  );
  await open();

  const withinSelector = within(getElementByClassName('.ant-select-selector'));
  await waitFor(() => {
    expect(
      withinSelector.queryByText(OPTIONS[0].label),
    ).not.toBeInTheDocument();
    expect(
      withinSelector.queryByText(OPTIONS[1].label),
    ).not.toBeInTheDocument();
    expect(
      withinSelector.queryByText(OPTIONS[2].label),
    ).not.toBeInTheDocument();
    expect(withinSelector.getByText('+ 3 ...')).toBeVisible();
  });

  await type('{esc}');

  expect(await withinSelector.findByText(OPTIONS[0].label)).toBeVisible();
  expect(withinSelector.queryByText(OPTIONS[1].label)).not.toBeInTheDocument();
  expect(withinSelector.queryByText(OPTIONS[2].label)).not.toBeInTheDocument();
  expect(withinSelector.getByText('+ 2 ...')).toBeVisible();
});

// Test for checking the issue described in: https://github.com/apache/superset/issues/35132
test('Maintains stable maxTagCount to prevent click target disappearing in oneLine mode', async () => {
  render(
    <Select
      {...defaultProps}
      value={[OPTIONS[0], OPTIONS[1], OPTIONS[2]]}
      mode="multiple"
      oneLine
    />,
  );

  const withinSelector = within(getElementByClassName('.ant-select-selector'));
  expect(withinSelector.getByText(OPTIONS[0].label)).toBeVisible();
  expect(withinSelector.getByText('+ 2 ...')).toBeVisible();

  await userEvent.click(getSelect());
  expect(withinSelector.getByText(OPTIONS[0].label)).toBeVisible();

  await waitFor(() => {
    expect(
      withinSelector.queryByText(OPTIONS[0].label),
    ).not.toBeInTheDocument();
    expect(withinSelector.getByText('+ 3 ...')).toBeVisible();
  });

  // Close dropdown
  await type('{esc}');

  expect(await withinSelector.findByText(OPTIONS[0].label)).toBeVisible();
  expect(withinSelector.getByText('+ 2 ...')).toBeVisible();
});

test('does not render "Select all" when there are 0 or 1 options', async () => {
  const { rerender } = render(
    <Select {...defaultProps} options={[]} mode="multiple" allowNewOptions />,
  );
  await open();
  expect(screen.queryByText(selectAllButtonText(0))).not.toBeInTheDocument();
  rerender(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 1)}
      mode="multiple"
      allowNewOptions
    />,
  );
  await open();
  expect(screen.queryByText(selectAllButtonText(1))).not.toBeInTheDocument();
  rerender(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 2)}
      mode="multiple"
      allowNewOptions
    />,
  );
  await open();
  expect(screen.getByText(selectAllButtonText(2))).toBeInTheDocument();
});

test('do not count unselected disabled options in "Select all"', async () => {
  const options = [...OPTIONS];
  options[0].disabled = true;
  options[1].disabled = true;
  render(
    <Select
      {...defaultProps}
      options={options}
      mode="multiple"
      value={options[0]}
    />,
  );
  await open();
  // We have 2 options disabled but one is selected initially
  // Select all should count one and ignore the other
  expect(
    screen.getByText(selectAllButtonText(OPTIONS.length - 1)),
  ).toBeInTheDocument();
});

test('"Deselect all" counts all selected options', async () => {
  render(<Select {...defaultProps} allowNewOptions mode="multiple" />);
  await open();
  await userEvent.click(await findSelectOption('Ava'));
  expect(await screen.findByText(deselectAllButtonText(1))).toBeInTheDocument();
});

test('"Deselect all" counts new selected options', async () => {
  render(<Select {...defaultProps} allowNewOptions mode="multiple" />);
  await open();
  await type(NEW_OPTION);
  await userEvent.click(await findSelectOption(NEW_OPTION));
  clearTypedText();
  await open();
  await userEvent.click(await findSelectOption('Ava'));
  expect(await screen.findByText(deselectAllButtonText(2))).toBeInTheDocument();
});

test('"Select all" does not count unselected new options', async () => {
  render(<Select {...defaultProps} allowNewOptions mode="multiple" />);
  await open();
  await type('er');
  // We have 5 options matching the search
  expect(await screen.findByText(selectAllButtonText(5))).toBeInTheDocument();
});

test('"Select all" does not affect disabled options', async () => {
  const options = [...OPTIONS];
  options[0].disabled = true;
  options[1].disabled = true;
  render(
    <Select
      {...defaultProps}
      options={options}
      mode="multiple"
      value={options[0]}
    />,
  );
  await open();

  // We have 2 options disabled but one is selected initially
  expect(await findSelectValue()).toHaveTextContent(options[0].label);
  expect(await findSelectValue()).not.toHaveTextContent(options[1].label);

  // Checking Select all shouldn't affect the disabled options
  const selectAll = selectAllButtonText(OPTIONS.length - 1);
  await userEvent.click(await screen.findByText(selectAll));
  expect(await findSelectValue()).toHaveTextContent(options[0].label);
  expect(await findSelectValue()).not.toHaveTextContent(options[1].label);

  // Unchecking Select all shouldn't affect the disabled options
  await userEvent.click(await screen.findByText(selectAll));
  expect(await findSelectValue()).toHaveTextContent(options[0].label);
  expect(await findSelectValue()).not.toHaveTextContent(options[1].label);
});

test('does not fire onChange when searching but no selection', async () => {
  const onChange = jest.fn();
  render(
    <div role="main">
      <Select
        {...defaultProps}
        onChange={onChange}
        mode="multiple"
        allowNewOptions
      />
    </div>,
  );
  await open();
  await type('Joh');
  await userEvent.click(await findSelectOption('John'));
  await userEvent.click(screen.getByRole('main'));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('fires onChange when clearing the selection in single mode', async () => {
  const onChange = jest.fn();
  render(
    <Select
      {...defaultProps}
      onChange={onChange}
      mode="single"
      value={OPTIONS[0]}
    />,
  );
  await clearAll();
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('fires onChange when clearing the selection in multiple mode', async () => {
  const onChange = jest.fn();
  render(
    <Select
      {...defaultProps}
      onChange={onChange}
      mode="multiple"
      value={OPTIONS[0]}
    />,
  );
  await clearAll();
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('fires onChange when pasting a selection', async () => {
  const onChange = jest.fn();
  render(<Select {...defaultProps} onChange={onChange} />);
  await open();
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => OPTIONS[0].label,
    },
  });
  fireEvent(input, paste);
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('does not duplicate options when using numeric values', async () => {
  render(
    <Select
      {...defaultProps}
      mode="multiple"
      options={[
        { label: '1', value: 1 },
        { label: '2', value: 2 },
      ]}
    />,
  );
  await type('1');
  await waitFor(() => expect(getAllSelectOptions().length).toBe(1));
});

test('pasting an existing option does not duplicate it', async () => {
  render(<Select {...defaultProps} options={[OPTIONS[0]]} />);
  await open();
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => OPTIONS[0].label,
    },
  });
  fireEvent(input, paste);
  expect(await findAllSelectOptions()).toHaveLength(1);
});

test('pasting an existing option does not duplicate it in multiple mode', async () => {
  const options = [
    { label: 'John', value: 1 },
    { label: 'Liam', value: 2 },
    { label: 'Olivia', value: 3 },
  ];
  render(
    <Select
      {...defaultProps}
      options={options}
      mode="multiple"
      allowSelectAll={false}
      allowNewOptions
    />,
  );
  await open();
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => 'John,Liam,Peter',
    },
  });
  fireEvent(input, paste);
  // Only Peter should be added
  expect(await findAllSelectOptions()).toHaveLength(4);
});

test('pasting an non-existent option should not add it if allowNewOptions is false', async () => {
  render(<Select {...defaultProps} options={[]} allowNewOptions={false} />);
  await open();
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => 'John',
    },
  });
  fireEvent(input, paste);
  expect(await findAllSelectOptions()).toHaveLength(0);
});

test('does not fire onChange if the same value is selected in single mode', async () => {
  const onChange = jest.fn();
  render(<Select {...defaultProps} onChange={onChange} />);
  const optionText = 'Emma';
  await open();
  expect(onChange).toHaveBeenCalledTimes(0);
  await userEvent.click(await findSelectOption(optionText));
  expect(onChange).toHaveBeenCalledTimes(1);
  await userEvent.click(await findSelectOption(optionText));
  expect(onChange).toHaveBeenCalledTimes(1);
});

// Reference for the bug this tests: https://github.com/apache/superset/pull/33043#issuecomment-2809419640
test('typing and deleting the last character for a new option displays correctly', async () => {
  jest.useFakeTimers();
  render(<Select {...defaultProps} allowNewOptions />);

  await open();
  await type('aaa', 0, false);

  jest.runAllTimers();

  await type('{backspace}', 0, false);
  await type('a', 0, false);

  jest.runAllTimers();

  expect(
    screen.queryByText(NO_DATA, { selector: '.ant-empty-description' }),
  ).not.toBeInTheDocument();
  expect(await findSelectOption('aaa')).toBeInTheDocument();

  jest.useRealTimers();
});

describe('grouped options search', () => {
  const GROUPED_OPTIONS = [
    {
      label: 'Male',
      options: OPTIONS.filter(option => option.gender === 'Male'),
    },
    {
      label: 'Female',
      options: OPTIONS.filter(option => option.gender === 'Female'),
    },
  ];

  it('searches within grouped options and shows matching groups', async () => {
    render(<Select {...defaultProps} options={GROUPED_OPTIONS} />);
    await open();

    await type('John');

    expect(await findSelectOption('John')).toBeInTheDocument();
    expect(await findSelectOption('Johnny')).toBeInTheDocument();
    expect(screen.queryByText('Female')).not.toBeInTheDocument();
    expect(screen.queryByText('Olivia')).not.toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.queryByText('Female')).not.toBeInTheDocument();
  });

  it('shows multiple groups when search matches both', async () => {
    render(<Select {...defaultProps} options={GROUPED_OPTIONS} />);
    await open();

    await type('er');

    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(await findSelectOption('Oliver')).toBeInTheDocument();
    expect(await findSelectOption('Cher')).toBeInTheDocument();
    expect(await findSelectOption('Her')).toBeInTheDocument();
  });

  it('handles case-insensitive search in grouped options', async () => {
    render(<Select {...defaultProps} options={GROUPED_OPTIONS} />);
    await open();

    await type('EMMA');

    expect(await findSelectOption('Emma')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.queryByText('Male')).not.toBeInTheDocument();
  });

  it('shows no options when search matches nothing in any group', async () => {
    render(<Select {...defaultProps} options={GROUPED_OPTIONS} />);
    await open();

    await type('xyz123');

    expect(screen.queryByText('Male')).not.toBeInTheDocument();
    expect(screen.queryByText('Female')).not.toBeInTheDocument();
    expect(
      screen.getByText(NO_DATA, { selector: '.ant-empty-description' }),
    ).toBeInTheDocument();
  });

  it('works in multiple selection mode with grouped options', async () => {
    render(
      <Select {...defaultProps} options={GROUPED_OPTIONS} mode="multiple" />,
    );
    await open();

    await type('John');

    await userEvent.click(await findSelectOption('John'));

    // Clear search and search for female name
    await clearTypedText();
    await type('Emma');
    await userEvent.click(await findSelectOption('Emma'));

    // Both should be selected
    const values = await findAllSelectValues();
    expect(values).toHaveLength(2);
    expect(values[0]).toHaveTextContent('John');
    expect(values[1]).toHaveTextContent('Emma');
  });

  it('preserves group structure when not searching', async () => {
    render(<Select {...defaultProps} options={GROUPED_OPTIONS} />);
    await open();

    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(await findSelectOption('John')).toBeInTheDocument();
    expect(await findSelectOption('Emma')).toBeInTheDocument();
  });

  it('handles empty groups gracefully', async () => {
    const optionsWithEmptyGroup = [
      ...GROUPED_OPTIONS,
      {
        label: 'Empty Group',
        options: [],
      },
    ];

    render(<Select {...defaultProps} options={optionsWithEmptyGroup} />);
    await open();

    await type('John');
    expect(await findSelectOption('John')).toBeInTheDocument();
    expect(screen.queryByText('Empty Group')).not.toBeInTheDocument();
  });
});

/*
 TODO: Add tests that require scroll interaction. Needs further investigation.
 - Fetches more data when scrolling and more data is available
 - Doesn't fetch more data when no more data is available
 - Requests the correct page and page size
 - Sets the page to zero when a new search is made
 */
