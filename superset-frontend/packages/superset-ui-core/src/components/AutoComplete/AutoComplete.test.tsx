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
import { useState } from 'react';
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import { Input } from '../Input';
import { AutoComplete } from '.';

const searchResult = (query: string): Array<{ value: string; label: string }> =>
  Array.from({ length: 3 }).map((_, idx) => ({
    value: `${query}${idx}`,
    label: `${query} result ${idx}`,
  }));

const AutoCompleteTest = () => {
  const [options, setOptions] = useState<{ value: string; label: string }[]>(
    [],
  );

  const handleSearch = (value: string) => {
    setOptions(value ? searchResult(value) : []);
  };

  return (
    <AutoComplete options={options} onSearch={handleSearch}>
      <Input placeholder="Type to search..." />
    </AutoComplete>
  );
};

describe('AutoComplete Component', () => {
  it('renders input field', () => {
    render(<AutoCompleteTest />);
    expect(
      screen.getByPlaceholderText('Type to search...'),
    ).toBeInTheDocument();
  });

  it('shows options when user types', async () => {
    render(<AutoCompleteTest />);
    const input = screen.getByPlaceholderText('Type to search...');
    await userEvent.type(input, 'test');

    await waitFor(() => {
      expect(screen.getByText('test result 0')).toBeInTheDocument();
      expect(screen.getByText('test result 1')).toBeInTheDocument();
      expect(screen.getByText('test result 2')).toBeInTheDocument();
    });
  });

  it('selecting an option updates input value', async () => {
    render(<AutoCompleteTest />);
    const input = screen.getByPlaceholderText('Type to search...');
    await userEvent.type(input, 'test');

    await waitFor(() => {
      expect(screen.getByText('test result 0')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('test result 0'));
    expect(input).toHaveValue('test0');
  });
});
