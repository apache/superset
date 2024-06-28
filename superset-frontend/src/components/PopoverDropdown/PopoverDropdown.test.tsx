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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import PopoverDropdown, {
  PopoverDropdownProps,
  OptionProps,
} from 'src/components/PopoverDropdown';

const defaultProps: PopoverDropdownProps = {
  id: 'popover-dropdown',
  options: [
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
  ],
  value: '1',
  renderButton: (option: OptionProps) => <span>{option.label}</span>,
  renderOption: (option: OptionProps) => <div>{option.label}</div>,
  onChange: jest.fn(),
};

test('renders with default props', async () => {
  render(<PopoverDropdown {...defaultProps} />);
  expect(await screen.findByRole('button')).toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveTextContent('Option 1');
});

test('renders the menu on click', async () => {
  render(<PopoverDropdown {...defaultProps} />);
  userEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('menu')).toBeInTheDocument();
});

test('renders with custom button', async () => {
  render(
    <PopoverDropdown
      {...defaultProps}
      renderButton={({ label, value }: OptionProps) => (
        <button type="button" key={value}>
          {`Custom ${label}`}
        </button>
      )}
    />,
  );
  expect(await screen.findByText('Custom Option 1')).toBeInTheDocument();
});

test('renders with custom option', async () => {
  render(
    <PopoverDropdown
      {...defaultProps}
      renderOption={({ label, value }: OptionProps) => (
        <button type="button" key={value}>
          {`Custom ${label}`}
        </button>
      )}
    />,
  );
  userEvent.click(screen.getByRole('button'));
  expect(await screen.findByText('Custom Option 1')).toBeInTheDocument();
});

test('triggers onChange', async () => {
  render(<PopoverDropdown {...defaultProps} />);
  userEvent.click(screen.getByRole('button'));
  expect(await screen.findByText('Option 2')).toBeInTheDocument();
  userEvent.click(screen.getByText('Option 2'));
  expect(defaultProps.onChange).toHaveBeenCalled();
});
