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
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import BulletRangeColorsControl from 'src/explore/components/controls/BulletRangeColorsControl';

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders a hint and no rows when no ranges are configured', () => {
  render(<BulletRangeColorsControl onChange={jest.fn()} />);

  expect(
    screen.getByText('Add ranges above to configure their colors here.'),
  ).toBeInTheDocument();
  expect(document.querySelectorAll('.ant-color-picker-trigger')).toHaveLength(
    0,
  );
});

test('renders one color picker row per parsed range, unset by default', () => {
  render(
    <BulletRangeColorsControl onChange={jest.fn()} ranges="100,200,300" />,
  );

  expect(screen.getByText(/Up to 100/)).toBeInTheDocument();
  expect(screen.getByText(/Up to 200/)).toBeInTheDocument();
  expect(screen.getByText(/Up to 300/)).toBeInTheDocument();
  expect(document.querySelectorAll('.ant-color-picker-trigger')).toHaveLength(
    3,
  );
  // no row has a custom color yet, so no "Use default" reset link shows
  expect(screen.queryByText('Use default')).not.toBeInTheDocument();
});

test('shows a "Use default" reset link only for rows with a custom color', () => {
  render(
    <BulletRangeColorsControl
      onChange={jest.fn()}
      ranges="100,200"
      value={['#ff0000', '']}
    />,
  );

  expect(screen.getAllByText('Use default')).toHaveLength(1);
});

test('calls onChange with the full color array when a row color is picked', async () => {
  const onChange = jest.fn();
  render(
    <BulletRangeColorsControl
      onChange={onChange}
      ranges="100,200"
      value={['', '']}
    />,
  );

  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);

  await userEvent.click(triggers[0]);
  await waitFor(() => {
    expect(document.querySelector('.ant-color-picker')).toBeInTheDocument();
  });

  const hexInput = document.querySelector<HTMLInputElement>(
    '.ant-color-picker-input input',
  );
  expect(hexInput).toBeInTheDocument();
  await userEvent.clear(hexInput!);
  await userEvent.type(hexInput!, '00ff00{enter}');

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });
  const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(lastCall[0].toLowerCase()).toBe('#00ff00');
  expect(lastCall[1]).toBe('');
});

test('resets a single row back to "no custom color" without touching the others', () => {
  const onChange = jest.fn();
  render(
    <BulletRangeColorsControl
      onChange={onChange}
      ranges="100,200"
      value={['#ff0000', '#00ff00']}
    />,
  );

  const resetButtons = screen.getAllByText('Use default');
  expect(resetButtons).toHaveLength(2);
  userEvent.click(resetButtons[0]);

  return waitFor(() => {
    expect(onChange).toHaveBeenCalledWith(['', '#00ff00']);
  });
});
