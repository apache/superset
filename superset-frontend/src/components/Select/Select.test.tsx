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
} from 'spec/helpers/testing-library';
import Select from 'src/components/Select/Select';
import { SELECT_ALL_VALUE } from './utils';

type Option = {
  label: string;
  value: number;
  gender: string;
  disabled?: boolean;
};

const ARIA_LABEL = 'Test';
const NEW_OPTION = 'Kyle';
const NO_DATA = 'No Data';
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

const selectAllOptionLabel = (numOptions: number) =>
  `${String(SELECT_ALL_VALUE)} (${numOptions})`;

const getElementByClassName = (className: string) =>
  document.querySelector(className)! as HTMLElement;

const getElementsByClassName = (className: string) =>
  document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

const getSelect = () => screen.getByRole('combobox', { name: ARIA_LABEL });

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

const findAllCheckedValues = () =>
  waitFor(() => [
    ...getElementsByClassName('.ant-select-item-option-selected'),
  ]);

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

const type = (text: string) => {
  const select = getSelect();
  userEvent.clear(select);
  return userEvent.type(select, text, { delay: 10 });
};

const clearTypedText = () => {
  const select = getSelect();
  userEvent.clear(select);
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
  userEvent.click(await findSelectOption(OPTIONS[0].label));
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
  userEvent.click(await findSelectOption(originalLabels[1]));
  // after selection, keep the original order
  expect(await matchOrder(originalLabels)).toBe(true);

  // order selected to top when reopen
  await reopen();
  let labels = originalLabels.slice();
  labels = labels.splice(1, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // keep clicking other items, the updated order should still based on
  // original order
  userEvent.click(await findSelectOption(originalLabels[5]));
  await matchOrder(labels);
  await reopen();
  labels = originalLabels.slice();
  labels = labels.splice(5, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // should revert to original order
  clearAll();
  await reopen();
  expect(await matchOrder(originalLabels)).toBe(true);
});

test('should sort selected to the top when in multi mode', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  const originalLabels = OPTIONS.map(option => option.label);
  let labels = originalLabels.slice();

  await open();
  userEvent.click(await findSelectOption(labels[2]));
  expect(
    await matchOrder([selectAllOptionLabel(originalLabels.length), ...labels]),
  ).toBe(true);

  await reopen();
  labels = labels.splice(2, 1).concat(labels);
  expect(
    await matchOrder([selectAllOptionLabel(originalLabels.length), ...labels]),
  ).toBe(true);

  await open();
  userEvent.click(await findSelectOption(labels[5]));
  await reopen();
  labels = [labels.splice(0, 1)[0], labels.splice(4, 1)[0]].concat(labels);
  expect(
    await matchOrder([selectAllOptionLabel(originalLabels.length), ...labels]),
  ).toBe(true);

  // should revert to original order
  clearAll();
  await reopen();
  expect(
    await matchOrder([
      selectAllOptionLabel(originalLabels.length),
      ...originalLabels,
    ]),
  ).toBe(true);
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
  expect(screen.getByText(NO_DATA)).toBeInTheDocument();
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
    { label: 'John', value: 1, customLabel: <h1>John</h1> },
    { label: 'Liam', value: 2, customLabel: <h1>Liam</h1> },
    { label: 'Olivia', value: 3, customLabel: <h1>Olivia</h1> },
  ];
  render(<Select {...defaultProps} options={options} />);
  await open();
  expect(screen.getByRole('heading', { name: 'John' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Liam' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Olivia' })).toBeInTheDocument();
});

test('searches for a word with a custom label', async () => {
  const options = [
    { label: 'John', value: 1, customLabel: <h1>John</h1> },
    { label: 'Liam', value: 2, customLabel: <h1>Liam</h1> },
    { label: 'Olivia', value: 3, customLabel: <h1>Olivia</h1> },
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
  clearAll();
  expect(onClear).toHaveBeenCalled();
  const values = await findAllSelectValues();
  expect(values.length).toBe(0);
});

test('does not add a new option if allowNewOptions is false', async () => {
  render(<Select {...defaultProps} options={OPTIONS} />);
  await open();
  await type(NEW_OPTION);
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
});

test('adds the null option when selected in single mode', async () => {
  render(<Select {...defaultProps} options={[OPTIONS[0], NULL_OPTION]} />);
  await open();
  userEvent.click(await findSelectOption(NULL_OPTION.label));
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
  userEvent.click(await findSelectOption(OPTIONS[0].label));
  userEvent.click(await findSelectOption(NULL_OPTION.label));
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
  expect(screen.getByText(NO_DATA)).toBeInTheDocument();
});

test('makes a selection in single mode', async () => {
  render(<Select {...defaultProps} />);
  const optionText = 'Emma';
  await open();
  userEvent.click(await findSelectOption(optionText));
  expect(await findSelectValue()).toHaveTextContent(optionText);
});

test('multiple selections in multiple mode', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  userEvent.click(await findSelectOption(firstOption.label));
  userEvent.click(await findSelectOption(secondOption.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(firstOption.label);
  expect(values[1]).toHaveTextContent(secondOption.label);
});

test('changes the selected item in single mode', async () => {
  const onChange = jest.fn();
  render(<Select {...defaultProps} onChange={onChange} />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  userEvent.click(await findSelectOption(firstOption.label));
  expect(await findSelectValue()).toHaveTextContent(firstOption.label);
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: firstOption.label,
      value: firstOption.value,
    }),
    expect.objectContaining(firstOption),
  );
  userEvent.click(await findSelectOption(secondOption.label));
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
  userEvent.click(await findSelectOption(firstOption.label));
  userEvent.click(await findSelectOption(secondOption.label));
  let values = await findAllSelectValues();
  expect(values.length).toBe(2);
  expect(values[0]).toHaveTextContent(firstOption.label);
  expect(values[1]).toHaveTextContent(secondOption.label);
  userEvent.click(await findSelectOption(firstOption.label));
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
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
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
  const options = await findAllSelectOptions();
  expect(options[0]).toHaveTextContent(selectAllOptionLabel(OPTIONS.length));
});

test('does not render "Select all" for single select', async () => {
  render(<Select {...defaultProps} options={OPTIONS} mode="single" />);
  await open();
  expect(
    screen.queryByText(selectAllOptionLabel(OPTIONS.length)),
  ).not.toBeInTheDocument();
});

test('does not render "Select all" for an empty multiple select', async () => {
  render(<Select {...defaultProps} options={[]} mode="multiple" />);
  await open();
  expect(
    screen.queryByText(selectAllOptionLabel(OPTIONS.length)),
  ).not.toBeInTheDocument();
});

test('does not render "Select all" when searching', async () => {
  render(<Select {...defaultProps} options={OPTIONS} mode="multiple" />);
  await open();
  await type('Select');
  await waitFor(() =>
    expect(
      screen.queryByText(selectAllOptionLabel(OPTIONS.length)),
    ).not.toBeInTheDocument(),
  );
});

test('does not render "Select all" as one of the tags after selection', async () => {
  render(<Select {...defaultProps} options={OPTIONS} mode="multiple" />);
  await open();
  userEvent.click(await findSelectOption(selectAllOptionLabel(OPTIONS.length)));
  const values = await findAllSelectValues();
  expect(values[0]).not.toHaveTextContent(selectAllOptionLabel(OPTIONS.length));
});

test('keeps "Select all" at the top after a selection', async () => {
  const selected = OPTIONS[2];
  render(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 10)}
      mode="multiple"
      value={[selected]}
    />,
  );
  await open();
  const options = await findAllSelectOptions();
  expect(options[0]).toHaveTextContent(selectAllOptionLabel(10));
  expect(options[1]).toHaveTextContent(selected.label);
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
  userEvent.click(await findSelectOption(selectAllOptionLabel(OPTIONS.length)));
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
  userEvent.click(await findSelectOption(selectAllOptionLabel(OPTIONS.length)));
  let values = await findAllSelectValues();
  expect(values.length).toBe(1);
  expect(values[0]).toHaveTextContent(`+ ${OPTIONS.length} ...`);
  userEvent.click(await findSelectOption(selectAllOptionLabel(OPTIONS.length)));
  values = await findAllSelectValues();
  expect(values.length).toBe(0);
});

test('deselecting a value also deselects "Select all"', async () => {
  render(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 10)}
      mode="multiple"
      maxTagCount={0}
    />,
  );
  await open();
  userEvent.click(await findSelectOption(selectAllOptionLabel(10)));
  let values = await findAllCheckedValues();
  expect(values[0]).toHaveTextContent(selectAllOptionLabel(10));
  userEvent.click(await findSelectOption(OPTIONS[0].label));
  values = await findAllCheckedValues();
  expect(values[0]).not.toHaveTextContent(selectAllOptionLabel(10));
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
  userEvent.click(await findSelectOption(NEW_OPTION));
  expect(await querySelectOption(NEW_OPTION)).not.toBeInTheDocument();
});

test('selecting all values also selects "Select all"', async () => {
  render(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 10)}
      mode="multiple"
      maxTagCount={0}
    />,
  );
  await open();
  const options = await findAllSelectOptions();
  options.forEach((option, index) => {
    // skip select all
    if (index > 0) {
      userEvent.click(option);
    }
  });
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(`+ 10 ...`);
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

test('+N tag does not count the "Select All" option', async () => {
  render(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 10)}
      mode="multiple"
      maxTagCount={0}
    />,
  );
  await open();
  userEvent.click(await findSelectOption(selectAllOptionLabel(10)));
  const values = await findAllSelectValues();
  // maxTagCount is 0 so the +N tag should be + 10 ...
  expect(values[0]).toHaveTextContent('+ 10 ...');
});

test('"Select All" is checked when unchecking a newly added option and all the other options are still selected', async () => {
  render(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 10)}
      mode="multiple"
      allowNewOptions
    />,
  );
  await open();
  userEvent.click(await findSelectOption(selectAllOptionLabel(10)));
  expect(await findSelectOption(selectAllOptionLabel(10))).toBeInTheDocument();
  // add a new option
  await type(NEW_OPTION);
  expect(await findSelectOption(NEW_OPTION)).toBeInTheDocument();
  clearTypedText();
  expect(await findSelectOption(selectAllOptionLabel(11))).toBeInTheDocument();
  // select all should be selected
  let values = await findAllCheckedValues();
  expect(values[0]).toHaveTextContent(selectAllOptionLabel(11));
  // remove new option
  userEvent.click(await findSelectOption(NEW_OPTION));
  // select all should still be selected
  values = await findAllCheckedValues();
  expect(values[0]).toHaveTextContent(selectAllOptionLabel(10));
  expect(await findSelectOption(selectAllOptionLabel(10))).toBeInTheDocument();
});

test('does not render "Select All" when there are 0 or 1 options', async () => {
  const { rerender } = render(
    <Select {...defaultProps} options={[]} mode="multiple" allowNewOptions />,
  );
  await open();
  expect(screen.queryByText(selectAllOptionLabel(0))).not.toBeInTheDocument();
  rerender(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 1)}
      mode="multiple"
      allowNewOptions
    />,
  );
  await open();
  expect(screen.queryByText(selectAllOptionLabel(1))).not.toBeInTheDocument();
  rerender(
    <Select
      {...defaultProps}
      options={OPTIONS.slice(0, 2)}
      mode="multiple"
      allowNewOptions
    />,
  );
  await open();
  expect(screen.getByText(selectAllOptionLabel(2))).toBeInTheDocument();
});

test('do not count unselected disabled options in "Select All"', async () => {
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
  // Select All should count one and ignore the other
  expect(
    screen.getByText(selectAllOptionLabel(OPTIONS.length - 1)),
  ).toBeInTheDocument();
});

test('"Select All" does not affect disabled options', async () => {
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

  // Checking Select All shouldn't affect the disabled options
  const selectAll = selectAllOptionLabel(OPTIONS.length - 1);
  userEvent.click(await findSelectOption(selectAll));
  expect(await findSelectValue()).toHaveTextContent(options[0].label);
  expect(await findSelectValue()).not.toHaveTextContent(options[1].label);

  // Unchecking Select All shouldn't affect the disabled options
  userEvent.click(await findSelectOption(selectAll));
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
  userEvent.click(await findSelectOption('John'));
  userEvent.click(screen.getByRole('main'));
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
  clearAll();
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
  clearAll();
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
  userEvent.click(await findSelectOption(optionText));
  expect(onChange).toHaveBeenCalledTimes(1);
  userEvent.click(await findSelectOption(optionText));
  expect(onChange).toHaveBeenCalledTimes(1);
});

/*
 TODO: Add tests that require scroll interaction. Needs further investigation.
 - Fetches more data when scrolling and more data is available
 - Doesn't fetch more data when no more data is available
 - Requests the correct page and page size
 - Sets the page to zero when a new search is made
 */
