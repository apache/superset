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

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: Function & { cancel: Function }) => {
    // eslint-disable-next-line no-param-reassign
    fn.cancel = jest.fn();
    return fn;
  },
}));

test('renders with default props', () => {
  render(<TimeSeriesColumnControl />);
  expect(screen.getByText('Time series columns')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'edit' })).toBeInTheDocument();
});

test('renders popover on edit', async () => {
  render(<TimeSeriesColumnControl />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  expect(screen.getByText('Label')).toBeInTheDocument();
  expect(screen.getByText('Tooltip')).toBeInTheDocument();
  expect(screen.getByText('Type')).toBeInTheDocument();
});

test('renders time comparison', async () => {
  render(<TimeSeriesColumnControl colType="time" />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  expect(screen.getByText('Time lag')).toBeInTheDocument();
  expect(screen.getAllByText('Type')[1]).toBeInTheDocument();
  expect(screen.getByText('Color bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
});

test('renders contribution', async () => {
  render(<TimeSeriesColumnControl colType="contrib" />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  expect(screen.getByText('Color bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
});

test('renders sparkline', async () => {
  render(<TimeSeriesColumnControl colType="spark" />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  expect(screen.getByText('Width')).toBeInTheDocument();
  expect(screen.getByText('Height')).toBeInTheDocument();
  expect(screen.getByText('Time ratio')).toBeInTheDocument();
  expect(screen.getByText('Show Y-axis')).toBeInTheDocument();
  expect(screen.getByText('Y-axis bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
  expect(screen.getByText('Date format')).toBeInTheDocument();
});

test('renders period average', async () => {
  render(<TimeSeriesColumnControl colType="avg" />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  expect(screen.getByText('Time lag')).toBeInTheDocument();
  expect(screen.getByText('Color bounds')).toBeInTheDocument();
  expect(screen.getByText('Number format')).toBeInTheDocument();
});

test('triggers onChange when type changes', async () => {
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  // The placeholder text node itself has `pointer-events: none` in antd's
  // CSS; click its parent selector box, which is the real click target.
  await userEvent.click(screen.getByText('Select ...').parentElement!);
  await userEvent.click(screen.getByText('Time comparison'));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ colType: 'time' }),
  );
});

test('triggers onChange when time lag changes', async () => {
  const timeLag = '1';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  const timeLagInput = screen.getByPlaceholderText('Time Lag');
  await userEvent.clear(timeLagInput);
  await userEvent.type(timeLagInput, timeLag);
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeLag }));
});

test('time lag allows negative values', async () => {
  const timeLag = '-1';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  const timeLagInput = screen.getByPlaceholderText('Time Lag');
  await userEvent.clear(timeLagInput);
  await userEvent.type(timeLagInput, timeLag);
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeLag }));
});

test('triggers onChange when color bounds changes', async () => {
  const min = 1;
  const max = 5;
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  const minInput = screen.getByPlaceholderText('Min');
  const maxInput = screen.getByPlaceholderText('Max');
  await userEvent.type(minInput, min.toString());
  await userEvent.type(maxInput, max.toString());
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ bounds: [min, max] }),
  );
});

test('triggers onChange when time type changes', async () => {
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  // The placeholder text node itself has `pointer-events: none` in antd's
  // CSS; click its parent selector box, which is the real click target.
  await userEvent.click(screen.getByText('Select ...').parentElement!);
  await userEvent.click(screen.getByText('Difference'));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ comparisonType: 'diff' }),
  );
});

test('triggers onChange when number format changes', async () => {
  const numberFormatString = 'Test format';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="time" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  await userEvent.type(
    screen.getByPlaceholderText('Number format string'),
    numberFormatString,
  );
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ d3format: numberFormatString }),
  );
});

test('triggers onChange when width changes', async () => {
  const width = '10';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  await userEvent.type(screen.getByPlaceholderText('Width'), width);
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ width }));
});

test('triggers onChange when height changes', async () => {
  const height = '10';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  await userEvent.type(screen.getByPlaceholderText('Height'), height);
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ height }));
});

test('triggers onChange when time ratio changes', async () => {
  const timeRatio = '10';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  await userEvent.type(screen.getByPlaceholderText('Time Ratio'), timeRatio);
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeRatio }));
});

test('triggers onChange when show Y-axis changes', async () => {
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  await userEvent.click(screen.getByRole('checkbox'));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ showYAxis: true }),
  );
});

test('triggers onChange when Y-axis bounds changes', async () => {
  const min = 1;
  const max = 5;
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  const minInput = screen.getByPlaceholderText('Min');
  const maxInput = screen.getByPlaceholderText('Max');
  await userEvent.type(minInput, min.toString());
  await userEvent.clear(maxInput);
  await userEvent.type(maxInput, max.toString());
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ yAxisBounds: [min, max] }),
  );
});

test('triggers onChange when date format changes', async () => {
  const dateFormat = 'yy/MM/dd';
  const onChange = jest.fn();
  render(<TimeSeriesColumnControl colType="spark" onChange={onChange} />);
  await userEvent.click(screen.getByRole('img', { name: 'edit' }));
  await userEvent.type(
    screen.getByPlaceholderText('Date format string'),
    dateFormat,
  );
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ dateFormat }),
  );
});
