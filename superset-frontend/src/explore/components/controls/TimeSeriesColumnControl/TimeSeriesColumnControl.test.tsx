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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import TimeSeriesColumnControl from '.';

jest.mock('lodash/debounce', () => (fn: Function & { cancel: Function }) => {
  // eslint-disable-next-line no-param-reassign
  fn.cancel = jest.fn();
  return fn;
});

test('renders with default props', () => {
  render(<TimeSeriesColumnControl />);
  expect(screen.getByText('Time series columns')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('renders popover on edit', () => {
  render(<TimeSeriesColumnControl />);
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  expect(screen.getByText('Label')).toBeInTheDocument();
  expect(screen.getByText('Tooltip')).toBeInTheDocument();
  expect(screen.getByText('Type')).toBeInTheDocument();
});

test('renders time comparison', () => {
  render(<TimeSeriesColumnControl colType="time" />);
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Time lag')).toBeInTheDocument();
  expect(screen.getAllByText('Type')[1]).toBeInTheDocument();
  expect(screen.getByText('Color bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
});

test('renders contribution', () => {
  render(<TimeSeriesColumnControl colType="contrib" />);
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Color bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
});

test('renders sparkline', () => {
  render(<TimeSeriesColumnControl colType="spark" />);
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Width')).toBeInTheDocument();
  expect(screen.getByText('Height')).toBeInTheDocument();
  expect(screen.getByText('Time ratio')).toBeInTheDocument();
  expect(screen.getByText('Show Y-axis')).toBeInTheDocument();
  expect(screen.getByText('Y-axis bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
  expect(screen.getByText('Date format')).toBeInTheDocument();
});

test('renders period average', () => {
  render(<TimeSeriesColumnControl colType="avg" />);
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Time lag')).toBeInTheDocument();
  expect(screen.getByText('Color bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
});

test('triggers onChange when type changes', () => {
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.click(screen.getByText('Select ...'));
  userEvent.click(screen.getByText('Time comparison'));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ colType: 'time' }),
  );
});

test('triggers onChange when time lag changes', () => {
  const timeLag = '1';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  const timeLagInput = screen.getByPlaceholderText('Time Lag');
  userEvent.clear(timeLagInput);
  userEvent.type(timeLagInput, timeLag);
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeLag }));
});

test('time lag allows negative values', () => {
  const timeLag = '-1';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  const timeLagInput = screen.getByPlaceholderText('Time Lag');
  userEvent.clear(timeLagInput);
  userEvent.type(timeLagInput, timeLag);
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeLag }));
});

test('triggers onChange when color bounds changes', () => {
  const min = 1;
  const max = 5;
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  const minInput = screen.getByPlaceholderText('Min');
  const maxInput = screen.getByPlaceholderText('Max');
  userEvent.type(minInput, min.toString());
  userEvent.type(maxInput, max.toString());
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ bounds: [min, max] }),
  );
});

test('triggers onChange when time type changes', () => {
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.click(screen.getByText('Select ...'));
  userEvent.click(screen.getByText('Difference'));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ comparisonType: 'diff' }),
  );
});

test('triggers onChange when number format changes', () => {
  const numberFormatString = 'Test format';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.type(
    screen.getByPlaceholderText('Number format string'),
    numberFormatString,
  );
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ d3format: numberFormatString }),
  );
});

test('triggers onChange when width changes', () => {
  const width = '10';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.type(screen.getByPlaceholderText('Width'), width);
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ width }));
});

test('triggers onChange when height changes', () => {
  const height = '10';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.type(screen.getByPlaceholderText('Height'), height);
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ height }));
});

test('triggers onChange when time ratio changes', () => {
  const timeRatio = '10';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.type(screen.getByPlaceholderText('Time Ratio'), timeRatio);
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeRatio }));
});

test('triggers onChange when show Y-axis changes', () => {
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.click(screen.getByRole('checkbox'));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ showYAxis: true }),
  );
});

test('triggers onChange when Y-axis bounds changes', () => {
  const min = 1;
  const max = 5;
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  const minInput = screen.getByPlaceholderText('Min');
  const maxInput = screen.getByPlaceholderText('Max');
  userEvent.type(minInput, min.toString());
  userEvent.clear(maxInput);
  userEvent.type(maxInput, max.toString());
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ yAxisBounds: [min, max] }),
  );
});

test('triggers onChange when date format changes', () => {
  const dateFormat = 'yy/MM/dd';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  userEvent.click(screen.getByRole('button'));
  userEvent.type(screen.getByPlaceholderText('Date format string'), dateFormat);
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ dateFormat }),
  );
});
