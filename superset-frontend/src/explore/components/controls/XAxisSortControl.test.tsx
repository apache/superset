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
import XAxisSortControl from 'src/explore/components/controls/XAxisSortControl';

const defaultProps = {
  name: 'x_axis_sort',
  onChange: jest.fn(),
  shouldReset: false,
  value: null as string | null,
  label: 'Sort X Axis By',
  choices: [
    ['ascending', 'Ascending'],
    ['descending', 'Descending'],
  ] as [string, string][],
};

// antd renders the selected option's label, not its value.
const ascending = () => screen.queryByText('Ascending');
const descending = () => screen.queryByText('Descending');

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('XAxisSortControl', () => {
  test('renders the value it was given', () => {
    render(<XAxisSortControl {...defaultProps} value="ascending" />);
    expect(ascending()).toBeInTheDocument();
  });

  test('follows the value prop when it changes', () => {
    const { rerender: rerenderControl } = render(
      <XAxisSortControl {...defaultProps} value="ascending" />,
    );

    expect(ascending()).toBeInTheDocument();

    rerenderControl(<XAxisSortControl {...defaultProps} value="descending" />);

    expect(descending()).toBeInTheDocument();
    expect(ascending()).not.toBeInTheDocument();
  });

  test('clears the value when shouldReset turns true', () => {
    const onChange = jest.fn();
    const { rerender: rerenderControl } = render(
      <XAxisSortControl
        {...defaultProps}
        value="ascending"
        onChange={onChange}
      />,
    );

    rerenderControl(
      <XAxisSortControl
        {...defaultProps}
        value="ascending"
        shouldReset
        onChange={onChange}
      />,
    );

    expect(ascending()).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
