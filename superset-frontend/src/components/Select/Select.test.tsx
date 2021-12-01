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
import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Select } from 'src/components';

const ARIA_LABEL = 'Test';
const NEW_OPTION = 'Kyle';
const NO_DATA = 'No Data';
const LOADING = 'Loading...';
const OPTIONS = [
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
].sort((option1, option2) => option1.label.localeCompare(option2.label));

const loadOptions = async (search: string, page: number, pageSize: number) => {
  const totalCount = OPTIONS.length;
  const start = page * pageSize;
  const deleteCount =
    start + pageSize < totalCount ? pageSize : totalCount - start;
  const data = OPTIONS.filter(option => option.label.match(search)).splice(
    start,
    deleteCount,
  );
  return {
    data,
    totalCount: OPTIONS.length,
  };
};

const defaultProps = {
  allowClear: true,
  ariaLabel: ARIA_LABEL,
  labelInValue: true,
  options: OPTIONS,
  pageSize: 10,
  showSearch: true,
};

const getElementByClassName = (className: string) =>
  document.querySelector(className)! as HTMLElement;

const getElementsByClassName = (className: string) =>
  document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

const getSelect = () => screen.getByRole('combobox', { name: ARIA_LABEL });

const findSelectOption = (text: string) =>
  waitFor(() =>
    within(getElementByClassName('.rc-virtual-list')).getByText(text),
  );

const findAllSelectOptions = () =>
  waitFor(() => getElementsByClassName('.ant-select-item-option-content'));

const findSelectValue = () =>
  waitFor(() => getElementByClassName('.ant-select-selection-item'));

const findAllSelectValues = () =>
  waitFor(() => getElementsByClassName('.ant-select-selection-item'));

const clearAll = () => userEvent.click(screen.getByLabelText('close-circle'));

const type = (text: string) => {
  const select = getSelect();
  userEvent.clear(select);
  return userEvent.type(select, text, { delay: 10 });
};

const open = () => waitFor(() => userEvent.click(getSelect()));

test('displays a header', async () => {
  const headerText = 'Header';
  render(<Select {...defaultProps} header={headerText} />);
  expect(screen.getByText(headerText)).toBeInTheDocument();
});

test('adds a new option if the value is not in the options', async () => {
  render(<Select {...defaultProps} options={[]} value={OPTIONS[0]} />);
  await open();
  expect(await findSelectOption(OPTIONS[0].label)).toBeInTheDocument();
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

test('sort the options using a custom sort comparator', async () => {
  const sortComparator = (
    option1: typeof OPTIONS[0],
    option2: typeof OPTIONS[0],
  ) => option1.gender.localeCompare(option2.gender);
  render(
    <Select
      {...defaultProps}
      options={loadOptions}
      sortComparator={sortComparator}
    />,
  );
  await open();
  const options = await findAllSelectOptions();
  const optionsPage = OPTIONS.slice(0, defaultProps.pageSize);
  const sortedOptions = optionsPage.sort(sortComparator);
  options.forEach((option, key) =>
    expect(option).toHaveTextContent(sortedOptions[key].label),
  );
});

test('displays the selected values first', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  const option3 = OPTIONS[2].label;
  const option8 = OPTIONS[7].label;
  await open();
  userEvent.click(await findSelectOption(option3));
  userEvent.click(await findSelectOption(option8));
  await type('{esc}');
  await open();
  const sortedOptions = await findAllSelectOptions();
  expect(sortedOptions[0]).toHaveTextContent(option3);
  expect(sortedOptions[1]).toHaveTextContent(option8);
});

test('displays the original order when unselecting', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  const option3 = OPTIONS[2].label;
  const option8 = OPTIONS[7].label;
  await open();
  userEvent.click(await findSelectOption(option3));
  userEvent.click(await findSelectOption(option8));
  await type('{esc}');
  clearAll();
  await open();
  const options = await findAllSelectOptions();
  options.forEach((option, key) =>
    expect(option).toHaveTextContent(OPTIONS[key].label),
  );
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

test('ignores case when searching', async () => {
  render(<Select {...defaultProps} />);
  await type('george');
  expect(await findSelectOption('George')).toBeInTheDocument();
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
  expect(options.length).toBe(5);
  expect(options[0]).toHaveTextContent('Ava');
  expect(options[1]).toHaveTextContent('Charlotte');
  expect(options[2]).toHaveTextContent('Emma');
  expect(options[3]).toHaveTextContent('Nikole');
  expect(options[4]).toHaveTextContent('Olivia');
  await type('1');
  expect(screen.getByText(NO_DATA)).toBeInTheDocument();
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
  render(<Select {...defaultProps} options={loadOptions} />);
  await open();
  await type(NEW_OPTION);
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
});

test('static - renders the select with default props', () => {
  render(<Select {...defaultProps} />);
  expect(getSelect()).toBeInTheDocument();
});

test('static - opens the select without any data', async () => {
  render(<Select {...defaultProps} options={[]} />);
  await open();
  expect(screen.getByText(NO_DATA)).toBeInTheDocument();
});

test('static - makes a selection in single mode', async () => {
  render(<Select {...defaultProps} />);
  const optionText = 'Emma';
  await open();
  userEvent.click(await findSelectOption(optionText));
  expect(await findSelectValue()).toHaveTextContent(optionText);
});

test('static - multiple selections in multiple mode', async () => {
  render(<Select {...defaultProps} mode="multiple" />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  userEvent.click(await findSelectOption(firstOption.label));
  userEvent.click(await findSelectOption(secondOption.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(firstOption.label);
  expect(values[1]).toHaveTextContent(secondOption.label);
});

test('static - changes the selected item in single mode', async () => {
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
    firstOption,
  );
  userEvent.click(await findSelectOption(secondOption.label));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: secondOption.label,
      value: secondOption.value,
    }),
    secondOption,
  );
  expect(await findSelectValue()).toHaveTextContent(secondOption.label);
});

test('static - deselects an item in multiple mode', async () => {
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

test('static - adds a new option if none is available and allowNewOptions is true', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  expect(await findSelectOption(NEW_OPTION)).toBeInTheDocument();
});

test('static - shows "No data" when allowNewOptions is false and a new option is entered', async () => {
  render(<Select {...defaultProps} allowNewOptions={false} />);
  await open();
  await type(NEW_OPTION);
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
});

test('static - does not show "No data" when allowNewOptions is true and a new option is entered', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  expect(screen.queryByText(NO_DATA)).not.toBeInTheDocument();
});

test('static - does not show "Loading..." when allowNewOptions is false and a new option is entered', async () => {
  render(<Select {...defaultProps} allowNewOptions={false} />);
  await open();
  await type(NEW_OPTION);
  expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
});

test('static - shows "Loading..." when allowNewOptions is true and a new option is entered', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  expect(await screen.findByText(LOADING)).toBeInTheDocument();
});

test('static - does not add a new option if the option already exists', async () => {
  render(<Select {...defaultProps} allowNewOptions />);
  const option = OPTIONS[0].label;
  await open();
  await type(option);
  expect(await findSelectOption(option)).toBeInTheDocument();
});

test('static - sets a initial value in single mode', async () => {
  render(<Select {...defaultProps} value={OPTIONS[0]} />);
  expect(await findSelectValue()).toHaveTextContent(OPTIONS[0].label);
});

test('static - sets a initial value in multiple mode', async () => {
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

test('static - searches for an item', async () => {
  render(<Select {...defaultProps} />);
  const search = 'Oli';
  await type(search);
  const options = await findAllSelectOptions();
  expect(options.length).toBe(2);
  expect(options[0]).toHaveTextContent('Oliver');
  expect(options[1]).toHaveTextContent('Olivia');
});

test('async - renders the select with default props', () => {
  render(<Select {...defaultProps} options={loadOptions} />);
  expect(getSelect()).toBeInTheDocument();
});

test('async - opens the select without any data', async () => {
  render(
    <Select
      {...defaultProps}
      options={async () => ({ data: [], totalCount: 0 })}
    />,
  );
  await open();
  expect(await screen.findByText(/no data/i)).toBeInTheDocument();
});

test('async - displays the loading indicator when opening', async () => {
  render(<Select {...defaultProps} options={loadOptions} />);
  await waitFor(() => {
    userEvent.click(getSelect());
    expect(screen.getByText(LOADING)).toBeInTheDocument();
  });
  expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
});

test('async - displays the loading indicator while searching', async () => {
  render(<Select {...defaultProps} options={loadOptions} />);
  await type('John');
  expect(screen.getByText(LOADING)).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument(),
  );
});

test('async - makes a selection in single mode', async () => {
  render(<Select {...defaultProps} options={loadOptions} />);
  const optionText = 'Emma';
  await open();
  userEvent.click(await findSelectOption(optionText));
  expect(await findSelectValue()).toHaveTextContent(optionText);
});

test('async - multiple selections in multiple mode', async () => {
  render(<Select {...defaultProps} options={loadOptions} mode="multiple" />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  userEvent.click(await findSelectOption(firstOption.label));
  userEvent.click(await findSelectOption(secondOption.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(firstOption.label);
  expect(values[1]).toHaveTextContent(secondOption.label);
});

test('async - changes the selected item in single mode', async () => {
  const onChange = jest.fn();
  render(
    <Select {...defaultProps} options={loadOptions} onChange={onChange} />,
  );
  await open();
  const [firstOption, secondOption] = OPTIONS;
  userEvent.click(await findSelectOption(firstOption.label));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: firstOption.label,
      value: firstOption.value,
    }),
    firstOption,
  );
  expect(await findSelectValue()).toHaveTextContent(firstOption.label);
  userEvent.click(await findSelectOption(secondOption.label));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: secondOption.label,
      value: secondOption.value,
    }),
    secondOption,
  );
  expect(await findSelectValue()).toHaveTextContent(secondOption.label);
});

test('async - deselects an item in multiple mode', async () => {
  render(<Select {...defaultProps} options={loadOptions} mode="multiple" />);
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

test('async - adds a new option if none is available and allowNewOptions is true', async () => {
  render(<Select {...defaultProps} options={loadOptions} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  expect(await findSelectOption(NEW_OPTION)).toBeInTheDocument();
});

test('async - does not add a new option if the option already exists', async () => {
  render(<Select {...defaultProps} options={loadOptions} allowNewOptions />);
  const option = OPTIONS[0].label;
  await open();
  await type(option);
  await waitFor(() => {
    const array = within(
      getElementByClassName('.rc-virtual-list'),
    ).getAllByText(option);
    expect(array.length).toBe(1);
  });
});

test('async - shows "No data" when allowNewOptions is false and a new option is entered', async () => {
  render(
    <Select
      {...defaultProps}
      options={loadOptions}
      allowNewOptions={false}
      showSearch
    />,
  );
  await open();
  await type(NEW_OPTION);
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
});

test('async - does not show "No data" when allowNewOptions is true and a new option is entered', async () => {
  render(<Select {...defaultProps} options={loadOptions} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  expect(screen.queryByText(NO_DATA)).not.toBeInTheDocument();
});

test('async - sets a initial value in single mode', async () => {
  render(<Select {...defaultProps} options={loadOptions} value={OPTIONS[0]} />);
  expect(await findSelectValue()).toHaveTextContent(OPTIONS[0].label);
});

test('async - sets a initial value in multiple mode', async () => {
  render(
    <Select
      {...defaultProps}
      mode="multiple"
      options={loadOptions}
      value={[OPTIONS[0], OPTIONS[1]]}
    />,
  );
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(OPTIONS[0].label);
  expect(values[1]).toHaveTextContent(OPTIONS[1].label);
});

test('async - searches for an item already loaded', async () => {
  render(<Select {...defaultProps} options={loadOptions} />);
  const search = 'Oli';
  await open();
  await type(search);
  await waitForElementToBeRemoved(screen.getByText(LOADING));
  const options = await findAllSelectOptions();
  expect(options.length).toBe(2);
  expect(options[0]).toHaveTextContent('Oliver');
  expect(options[1]).toHaveTextContent('Olivia');
});

test('async - searches for an item in a page not loaded', async () => {
  render(<Select {...defaultProps} options={loadOptions} />);
  const search = 'Ashfaq';
  await open();
  await type(search);
  await waitForElementToBeRemoved(screen.getByText(LOADING));
  const options = await findAllSelectOptions();
  expect(options.length).toBe(1);
  expect(options[0]).toHaveTextContent(search);
});

test('async - does not fetches data when rendering', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(<Select {...defaultProps} options={loadOptions} />);
  expect(loadOptions).not.toHaveBeenCalled();
});

test('async - fetches data when opening', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(<Select {...defaultProps} options={loadOptions} />);
  await open();
  expect(loadOptions).toHaveBeenCalled();
});

test('async - fetches data only after a search input is entered if fetchOnlyOnSearch is true', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(<Select {...defaultProps} options={loadOptions} fetchOnlyOnSearch />);
  await open();
  await waitFor(() => expect(loadOptions).not.toHaveBeenCalled());
  await type('search');
  await waitFor(() => expect(loadOptions).toHaveBeenCalled());
});

test('async - displays an error message when an exception is thrown while fetching', async () => {
  const error = 'Fetch error';
  const loadOptions = async () => {
    throw new Error(error);
  };
  render(<Select {...defaultProps} options={loadOptions} />);
  await open();
  expect(screen.getByText(error)).toBeInTheDocument();
});

test('async - does not fire a new request for the same search input', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(<Select {...defaultProps} options={loadOptions} fetchOnlyOnSearch />);
  await type('search');
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
  expect(loadOptions).toHaveBeenCalledTimes(1);
  clearAll();
  await type('search');
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
  expect(loadOptions).toHaveBeenCalledTimes(1);
});

test('async - does not fire a new request if all values have been fetched', async () => {
  const mock = jest.fn(loadOptions);
  const search = 'George';
  const pageSize = OPTIONS.length;
  render(<Select {...defaultProps} options={mock} pageSize={pageSize} />);
  await open();
  expect(mock).toHaveBeenCalledTimes(1);
  await type(search);
  expect(await findSelectOption(search)).toBeInTheDocument();
  expect(mock).toHaveBeenCalledTimes(1);
});

test('async - fires a new request if all values have not been fetched', async () => {
  const mock = jest.fn(loadOptions);
  const search = 'George';
  const pageSize = OPTIONS.length / 2;
  render(<Select {...defaultProps} options={mock} pageSize={pageSize} />);
  await open();
  expect(mock).toHaveBeenCalledTimes(1);
  await type(search);
  expect(await findSelectOption(search)).toBeInTheDocument();
  expect(mock).toHaveBeenCalledTimes(2);
});

/*
 TODO: Add tests that require scroll interaction. Needs further investigation.
 - Fetches more data when scrolling and more data is available
 - Doesn't fetch more data when no more data is available
 - Requests the correct page and page size
 - Sets the page to zero when a new search is made
 */
