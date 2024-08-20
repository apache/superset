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
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { AsyncSelect } from 'src/components';

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
  { label: 'Herme', value: 21, gender: 'Male' },
  { label: 'Cher', value: 22, gender: 'Female' },
  { label: 'Her', value: 23, gender: 'Male' },
].sort((option1, option2) => option1.label.localeCompare(option2.label));
const NULL_OPTION = { label: '<NULL>', value: null } as unknown as {
  label: string;
  value: number;
};

const loadOptions = async (search: string, page: number, pageSize: number) => {
  const totalCount = OPTIONS.length;
  const start = page * pageSize;
  const deleteCount =
    start + pageSize < totalCount ? pageSize : totalCount - start;
  const searchValue = search.trim().toLowerCase();
  const optionFilterProps = ['label', 'value', 'gender'];
  const data = OPTIONS.filter(option =>
    optionFilterProps.some(prop => {
      const optionProp = option?.[prop]
        ? String(option[prop]).trim().toLowerCase()
        : '';
      return optionProp.includes(searchValue);
    }),
  ).splice(start, deleteCount);
  return {
    data,
    totalCount: OPTIONS.length,
  };
};

const defaultProps = {
  allowClear: true,
  ariaLabel: ARIA_LABEL,
  labelInValue: true,
  options: loadOptions,
  pageSize: 10,
  showSearch: true,
};

const getElementByClassName = (className: string) =>
  document.querySelector(className)! as HTMLElement;

const getElementsByClassName = (className: string) =>
  document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

const getSelect = () => screen.getByRole('combobox', { name: ARIA_LABEL });

const getAllSelectOptions = () =>
  getElementsByClassName('.ant-select-item-option-content');

const findSelectOption = (text: string) =>
  waitFor(() =>
    within(getElementByClassName('.rc-virtual-list')).getByText(text),
  );

const querySelectOption = (text: string) =>
  waitFor(() =>
    within(getElementByClassName('.rc-virtual-list')).queryByText(text),
  );

const findAllSelectOptions = () =>
  waitFor(() => getElementsByClassName('.ant-select-item-option-content'));

const findSelectValue = () =>
  waitFor(() => getElementByClassName('.ant-select-selection-item'));

const findAllSelectValues = () =>
  waitFor(() => getElementsByClassName('.ant-select-selection-item'));

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

const open = () => waitFor(() => userEvent.click(getSelect()));

test('displays a header', async () => {
  const headerText = 'Header';
  render(<AsyncSelect {...defaultProps} header={headerText} />);
  expect(screen.getByText(headerText)).toBeInTheDocument();
});

test('adds a new option if the value is not in the options, when options are empty', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(
    <AsyncSelect {...defaultProps} options={loadOptions} value={OPTIONS[0]} />,
  );
  await open();
  expect(await findSelectOption(OPTIONS[0].label)).toBeInTheDocument();
  const options = await findAllSelectOptions();
  expect(options).toHaveLength(1);
  options.forEach((option, i) =>
    expect(option).toHaveTextContent(OPTIONS[i].label),
  );
});

test('adds a new option if the value is not in the options, when options have values', async () => {
  const loadOptions = jest.fn(async () => ({
    data: [OPTIONS[1]],
    totalCount: 1,
  }));
  render(
    <AsyncSelect {...defaultProps} options={loadOptions} value={OPTIONS[0]} />,
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
  const loadOptions = jest.fn(async () => ({
    data: [OPTIONS[0]],
    totalCount: 1,
  }));
  render(
    <AsyncSelect {...defaultProps} options={loadOptions} value={OPTIONS[0]} />,
  );
  await open();
  expect(await findSelectOption(OPTIONS[0].label)).toBeInTheDocument();
  const options = await findAllSelectOptions();
  expect(options).toHaveLength(1);
});

test('inverts the selection', async () => {
  render(<AsyncSelect {...defaultProps} invertSelection />);
  await open();
  userEvent.click(await findSelectOption(OPTIONS[0].label));
  expect(await screen.findByLabelText('stop')).toBeInTheDocument();
});

test('sort the options by label if no sort comparator is provided', async () => {
  const loadUnsortedOptions = jest.fn(async () => ({
    data: [...OPTIONS].sort(() => Math.random()),
    totalCount: 2,
  }));
  render(<AsyncSelect {...defaultProps} options={loadUnsortedOptions} />);
  await open();
  const options = await findAllSelectOptions();
  options.forEach((option, key) =>
    expect(option).toHaveTextContent(OPTIONS[key].label),
  );
});

test('sort the options using a custom sort comparator', async () => {
  const sortComparator = (
    option1: (typeof OPTIONS)[0],
    option2: (typeof OPTIONS)[0],
  ) => option1.gender.localeCompare(option2.gender);
  render(<AsyncSelect {...defaultProps} sortComparator={sortComparator} />);
  await open();
  const options = await findAllSelectOptions();
  const optionsPage = OPTIONS.slice(0, defaultProps.pageSize);
  const sortedOptions = optionsPage.sort(sortComparator);
  options.forEach((option, key) => {
    expect(option).toHaveTextContent(sortedOptions[key].label);
  });
});

test('should sort selected to top when in single mode', async () => {
  render(<AsyncSelect {...defaultProps} mode="single" />);
  const originalLabels = OPTIONS.map(option => option.label);
  await open();
  userEvent.click(await findSelectOption(originalLabels[1]));
  // after selection, keep the original order
  expect(await matchOrder(originalLabels)).toBe(true);

  // order selected to top when reopen
  await type('{esc}');
  await open();
  let labels = originalLabels.slice();
  labels = labels.splice(1, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // keep clicking other items, the updated order should still based on
  // original order
  userEvent.click(await findSelectOption(originalLabels[5]));
  await matchOrder(labels);
  await type('{esc}');
  await open();
  labels = originalLabels.slice();
  labels = labels.splice(5, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // should revert to original order
  clearAll();
  await type('{esc}');
  await open();
  expect(await matchOrder(originalLabels)).toBe(true);
});

test('should sort selected to the top when in multi mode', async () => {
  render(<AsyncSelect {...defaultProps} mode="multiple" />);
  const originalLabels = OPTIONS.map(option => option.label);
  let labels = originalLabels.slice();

  await open();
  userEvent.click(await findSelectOption(labels[1]));
  expect(await matchOrder(labels)).toBe(true);

  await type('{esc}');
  await open();
  labels = labels.splice(1, 1).concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  await open();
  userEvent.click(await findSelectOption(labels[5]));
  await type('{esc}');
  await open();
  labels = [labels.splice(0, 1)[0], labels.splice(4, 1)[0]].concat(labels);
  expect(await matchOrder(labels)).toBe(true);

  // should revert to original order
  clearAll();
  await type('{esc}');
  await open();
  expect(await matchOrder(originalLabels)).toBe(true);
});

test('searches for label or value', async () => {
  const option = OPTIONS[11];
  render(<AsyncSelect {...defaultProps} />);
  const search = option.value;
  await type(search.toString());
  expect(await findSelectOption(option.label)).toBeInTheDocument();
  const options = await findAllSelectOptions();
  expect(options.length).toBe(1);
  expect(options[0]).toHaveTextContent(option.label);
});

test('search order exact and startWith match first', async () => {
  render(<AsyncSelect {...defaultProps} />);
  await open();
  await type('Her');
  expect(await findSelectOption('Guilherme')).toBeInTheDocument();
  const options = await findAllSelectOptions();
  expect(options.length).toBe(4);
  expect(options[0]).toHaveTextContent('Her');
  expect(options[1]).toHaveTextContent('Herme');
  expect(options[2]).toHaveTextContent('Cher');
  expect(options[3]).toHaveTextContent('Guilherme');
});

test('ignores case when searching', async () => {
  render(<AsyncSelect {...defaultProps} />);
  await type('george');
  expect(await findSelectOption('George')).toBeInTheDocument();
});

test('same case should be ranked to the top', async () => {
  const loadOptions = jest.fn(async () => ({
    data: [
      { value: 'Cac' },
      { value: 'abac' },
      { value: 'acbc' },
      { value: 'CAc' },
    ],
    totalCount: 4,
  }));
  render(<AsyncSelect {...defaultProps} options={loadOptions} />);
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
  render(<AsyncSelect {...defaultProps} />);
  await type('{shift}');
  expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
});

test('searches for custom fields', async () => {
  render(
    <AsyncSelect {...defaultProps} optionFilterProps={['label', 'gender']} />,
  );
  await open();
  await type('Liam');
  // Liam is on the second page. need to wait to fetch options
  expect(await findSelectOption('Liam')).toBeInTheDocument();
  let options = await findAllSelectOptions();
  expect(options.length).toBe(1);
  expect(options[0]).toHaveTextContent('Liam');
  await type('Female');
  // Olivia is on the second page. need to wait to fetch options
  expect(await findSelectOption('Olivia')).toBeInTheDocument();
  options = await findAllSelectOptions();
  expect(options.length).toBe(6);
  expect(options[0]).toHaveTextContent('Ava');
  expect(options[1]).toHaveTextContent('Charlotte');
  expect(options[2]).toHaveTextContent('Cher');
  expect(options[3]).toHaveTextContent('Emma');
  expect(options[4]).toHaveTextContent('Nikole');
  expect(options[5]).toHaveTextContent('Olivia');
  await type('1');
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
});

test('removes duplicated values', async () => {
  render(<AsyncSelect {...defaultProps} mode="multiple" allowNewOptions />);
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => 'a,b,b,b,c,d,d',
    },
  });
  fireEvent(input, paste);
  await waitFor(async () => {
    const values = await findAllSelectValues();
    expect(values.length).toBe(4);
    expect(values[0]).toHaveTextContent('a');
    expect(values[1]).toHaveTextContent('b');
    expect(values[2]).toHaveTextContent('c');
    expect(values[3]).toHaveTextContent('d');
  });
});

test('renders a custom label', async () => {
  const loadOptions = jest.fn(async () => ({
    data: [
      { label: 'John', value: 1, customLabel: <h1>John</h1> },
      { label: 'Liam', value: 2, customLabel: <h1>Liam</h1> },
      { label: 'Olivia', value: 3, customLabel: <h1>Olivia</h1> },
    ],
    totalCount: 3,
  }));
  render(<AsyncSelect {...defaultProps} options={loadOptions} />);
  await open();
  expect(screen.getByRole('heading', { name: 'John' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Liam' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Olivia' })).toBeInTheDocument();
});

test('searches for a word with a custom label', async () => {
  const loadOptions = jest.fn(async () => ({
    data: [
      { label: 'John', value: 1, customLabel: <h1>John</h1> },
      { label: 'Liam', value: 2, customLabel: <h1>Liam</h1> },
      { label: 'Olivia', value: 3, customLabel: <h1>Olivia</h1> },
    ],
    totalCount: 3,
  }));
  render(<AsyncSelect {...defaultProps} options={loadOptions} />);
  await type('Liam');
  const selectOptions = await findAllSelectOptions();
  expect(selectOptions.length).toBe(1);
  expect(selectOptions[0]).toHaveTextContent('Liam');
});

test('removes a new option if the user does not select it', async () => {
  render(<AsyncSelect {...defaultProps} allowNewOptions />);
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
    <AsyncSelect
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
  render(<AsyncSelect {...defaultProps} />);
  await open();
  await type(NEW_OPTION);
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
});

test('adds the null option when selected in single mode', async () => {
  const loadOptions = jest.fn(async () => ({
    data: [OPTIONS[0], NULL_OPTION],
    totalCount: 2,
  }));
  render(<AsyncSelect {...defaultProps} options={loadOptions} />);
  await open();
  userEvent.click(await findSelectOption(NULL_OPTION.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(NULL_OPTION.label);
});

test('adds the null option when selected in multiple mode', async () => {
  const loadOptions = jest.fn(async () => ({
    data: [OPTIONS[0], NULL_OPTION],
    totalCount: 2,
  }));
  render(
    <AsyncSelect {...defaultProps} options={loadOptions} mode="multiple" />,
  );
  await open();
  userEvent.click(await findSelectOption(OPTIONS[0].label));
  userEvent.click(await findSelectOption(NULL_OPTION.label));
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(OPTIONS[0].label);
  expect(values[1]).toHaveTextContent(NULL_OPTION.label);
});

test('renders the select with default props', () => {
  render(<AsyncSelect {...defaultProps} />);
  expect(getSelect()).toBeInTheDocument();
});

test('opens the select without any data', async () => {
  render(
    <AsyncSelect
      {...defaultProps}
      options={async () => ({ data: [], totalCount: 0 })}
    />,
  );
  await open();
  expect(await screen.findByText(/no data/i)).toBeInTheDocument();
});

test('displays the loading indicator when opening', async () => {
  render(<AsyncSelect {...defaultProps} />);
  await waitFor(() => {
    userEvent.click(getSelect());
    expect(screen.getByText(LOADING)).toBeInTheDocument();
  });
  expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
});

test('makes a selection in single mode', async () => {
  render(<AsyncSelect {...defaultProps} />);
  const optionText = 'Emma';
  await open();
  userEvent.click(await findSelectOption(optionText));
  expect(await findSelectValue()).toHaveTextContent(optionText);
});

test('multiple selections in multiple mode', async () => {
  render(<AsyncSelect {...defaultProps} mode="multiple" />);
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
  render(<AsyncSelect {...defaultProps} onChange={onChange} />);
  await open();
  const [firstOption, secondOption] = OPTIONS;
  userEvent.click(await findSelectOption(firstOption.label));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: firstOption.label,
      value: firstOption.value,
    }),
    expect.objectContaining(firstOption),
  );
  expect(await findSelectValue()).toHaveTextContent(firstOption.label);
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
  render(<AsyncSelect {...defaultProps} mode="multiple" />);
  await open();
  const option3 = OPTIONS[2];
  const option8 = OPTIONS[7];
  userEvent.click(await findSelectOption(option8.label));
  userEvent.click(await findSelectOption(option3.label));

  let options = await findAllSelectOptions();
  expect(options).toHaveLength(Math.min(defaultProps.pageSize, OPTIONS.length));
  expect(options[0]).toHaveTextContent(OPTIONS[0].label);
  expect(options[1]).toHaveTextContent(OPTIONS[1].label);

  await type('{esc}');
  await open();

  // should rank selected options to the top after menu closes
  options = await findAllSelectOptions();
  expect(options).toHaveLength(Math.min(defaultProps.pageSize, OPTIONS.length));
  expect(options[0]).toHaveTextContent(option3.label);
  expect(options[1]).toHaveTextContent(option8.label);

  let values = await findAllSelectValues();
  expect(values).toHaveLength(2);
  // should keep the order by which the options were selected
  expect(values[0]).toHaveTextContent(option8.label);
  expect(values[1]).toHaveTextContent(option3.label);

  userEvent.click(await findSelectOption(option3.label));
  values = await findAllSelectValues();
  expect(values.length).toBe(1);
  expect(values[0]).toHaveTextContent(option8.label);
});

test('adds a new option if none is available and allowNewOptions is true', async () => {
  render(<AsyncSelect {...defaultProps} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  expect(await findSelectOption(NEW_OPTION)).toBeInTheDocument();
});

test('does not add a new option if the option already exists', async () => {
  render(<AsyncSelect {...defaultProps} allowNewOptions />);
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

test('shows "No data" when allowNewOptions is false and a new option is entered', async () => {
  render(<AsyncSelect {...defaultProps} allowNewOptions={false} showSearch />);
  await open();
  await type(NEW_OPTION);
  expect(await screen.findByText(NO_DATA)).toBeInTheDocument();
});

test('does not show "No data" when allowNewOptions is true and a new option is entered', async () => {
  render(<AsyncSelect {...defaultProps} allowNewOptions />);
  await open();
  await type(NEW_OPTION);
  await waitFor(() =>
    expect(screen.queryByText(NO_DATA)).not.toBeInTheDocument(),
  );
});

test('sets a initial value in single mode', async () => {
  render(<AsyncSelect {...defaultProps} value={OPTIONS[0]} />);
  expect(await findSelectValue()).toHaveTextContent(OPTIONS[0].label);
});

test('sets a initial value in multiple mode', async () => {
  render(
    <AsyncSelect
      {...defaultProps}
      mode="multiple"
      value={[OPTIONS[0], OPTIONS[1]]}
    />,
  );
  const values = await findAllSelectValues();
  expect(values[0]).toHaveTextContent(OPTIONS[0].label);
  expect(values[1]).toHaveTextContent(OPTIONS[1].label);
});

test('searches for matches in both loaded and unloaded pages', async () => {
  render(<AsyncSelect {...defaultProps} />);
  await open();
  await type('and');

  let options = await findAllSelectOptions();
  expect(options.length).toBe(1);
  expect(options[0]).toHaveTextContent('Alehandro');

  await screen.findByText('Sandro');
  options = await findAllSelectOptions();
  expect(options.length).toBe(2);
  expect(options[0]).toHaveTextContent('Alehandro');
  expect(options[1]).toHaveTextContent('Sandro');
});

test('searches for an item in a page not loaded', async () => {
  const mock = jest.fn(loadOptions);
  render(<AsyncSelect {...defaultProps} options={mock} />);
  const search = 'Sandro';
  await open();
  await type(search);
  await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
  const options = await findAllSelectOptions();
  expect(options.length).toBe(1);
  expect(options[0]).toHaveTextContent(search);
});

test('does not fetches data when rendering', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(<AsyncSelect {...defaultProps} options={loadOptions} />);
  expect(loadOptions).not.toHaveBeenCalled();
});

test('fetches data when opening', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(<AsyncSelect {...defaultProps} options={loadOptions} />);
  await open();
  expect(loadOptions).toHaveBeenCalled();
});

test('fetches data only after a search input is entered if fetchOnlyOnSearch is true', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(
    <AsyncSelect {...defaultProps} options={loadOptions} fetchOnlyOnSearch />,
  );
  await open();
  await waitFor(() => expect(loadOptions).not.toHaveBeenCalled());
  await type('search');
  await waitFor(() => expect(loadOptions).toHaveBeenCalled());
});

test('displays an error message when an exception is thrown while fetching', async () => {
  const error = 'Fetch error';
  const loadOptions = async () => {
    throw new Error(error);
  };
  render(<AsyncSelect {...defaultProps} options={loadOptions} />);
  await open();
  expect(screen.getByText(error)).toBeInTheDocument();
});

test('does not fire a new request for the same search input', async () => {
  const loadOptions = jest.fn(async () => ({ data: [], totalCount: 0 }));
  render(
    <AsyncSelect {...defaultProps} options={loadOptions} fetchOnlyOnSearch />,
  );
  await type('search');
  await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1));
  await type('search');
  await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1));
});

test('does not fire a new request if all values have been fetched', async () => {
  const mock = jest.fn(loadOptions);
  const search = 'George';
  const pageSize = OPTIONS.length;
  render(<AsyncSelect {...defaultProps} options={mock} pageSize={pageSize} />);
  await open();
  expect(mock).toHaveBeenCalledTimes(1);
  await type(search);
  expect(await findSelectOption(search)).toBeInTheDocument();
  expect(mock).toHaveBeenCalledTimes(1);
});

test('fires a new request if all values have not been fetched', async () => {
  const mock = jest.fn(loadOptions);
  const pageSize = OPTIONS.length / 2;
  render(<AsyncSelect {...defaultProps} options={mock} pageSize={pageSize} />);
  await open();
  expect(mock).toHaveBeenCalledTimes(1);
  await type('or');

  // `George` is on the first page so when it appears the API has not been called again
  expect(await findSelectOption('George')).toBeInTheDocument();
  expect(mock).toHaveBeenCalledTimes(1);

  // `Igor` is on the second paged API request
  expect(await findSelectOption('Igor')).toBeInTheDocument();
  expect(mock).toHaveBeenCalledTimes(2);
});

test('does not render a helper text by default', async () => {
  render(<AsyncSelect {...defaultProps} />);
  await open();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

test('renders a helper text when one is provided', async () => {
  const helperText = 'Helper text';
  render(<AsyncSelect {...defaultProps} helperText={helperText} />);
  await open();
  expect(screen.getByRole('note')).toBeInTheDocument();
  expect(screen.queryByText(helperText)).toBeInTheDocument();
});

test('finds an element with a numeric value and does not duplicate the options', async () => {
  const options = jest.fn(async () => ({
    data: [
      { label: 'a', value: 11 },
      { label: 'b', value: 12 },
    ],
    totalCount: 2,
  }));
  render(<AsyncSelect {...defaultProps} options={options} allowNewOptions />);
  await open();
  await type('11');
  expect(await findSelectOption('a')).toBeInTheDocument();
  expect(await querySelectOption('11')).not.toBeInTheDocument();
});

test('Renders only 1 tag and an overflow tag in oneLine mode', () => {
  render(
    <AsyncSelect
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
    <AsyncSelect
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

test('does not fire onChange when searching but no selection', async () => {
  const onChange = jest.fn();
  render(
    <div role="main">
      <AsyncSelect
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
    <AsyncSelect
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
    <AsyncSelect
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
  render(<AsyncSelect {...defaultProps} onChange={onChange} />);
  await open();
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => OPTIONS[0].label,
    },
  });
  fireEvent(input, paste);
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
});

test('does not duplicate options when using numeric values', async () => {
  render(
    <AsyncSelect
      {...defaultProps}
      mode="multiple"
      options={async () => ({
        data: [
          { label: '1', value: 1 },
          { label: '2', value: 2 },
        ],
        totalCount: 2,
      })}
    />,
  );
  await type('1');
  await waitFor(() => expect(getAllSelectOptions().length).toBe(1));
});

test('pasting an existing option does not duplicate it', async () => {
  const options = jest.fn(async () => ({
    data: [OPTIONS[0]],
    totalCount: 1,
  }));
  render(<AsyncSelect {...defaultProps} options={options} />);
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
  const options = jest.fn(async () => ({
    data: [
      { label: 'John', value: 1 },
      { label: 'Liam', value: 2 },
      { label: 'Olivia', value: 3 },
    ],
    totalCount: 3,
  }));
  render(
    <AsyncSelect
      {...defaultProps}
      options={options}
      mode="multiple"
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
  await waitFor(async () =>
    // Only Peter should be added
    expect(await findAllSelectOptions()).toHaveLength(4),
  );
});

test('pasting an non-existent option should not add it if allowNewOptions is false', async () => {
  render(
    <AsyncSelect
      {...defaultProps}
      allowNewOptions={false}
      options={async () => ({ data: [], totalCount: 0 })}
    />,
  );
  await open();
  const input = getElementByClassName('.ant-select-selection-search-input');
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => 'John',
    },
  });
  await waitFor(() => fireEvent(input, paste));
  expect(await findAllSelectOptions()).toHaveLength(0);
});

test('onChange is called with the value property when pasting an option that was not loaded yet', async () => {
  const onChange = jest.fn();
  render(<AsyncSelect {...defaultProps} onChange={onChange} />);
  await open();
  const input = getElementByClassName('.ant-select-selection-search-input');
  const lastOption = OPTIONS[OPTIONS.length - 1];
  const paste = createEvent.paste(input, {
    clipboardData: {
      getData: () => lastOption.label,
    },
  });
  fireEvent(input, paste);
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ value: lastOption.value }),
      expect.anything(),
    ),
  );
});

test('does not fire onChange if the same value is selected in single mode', async () => {
  const onChange = jest.fn();
  render(<AsyncSelect {...defaultProps} onChange={onChange} />);
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
