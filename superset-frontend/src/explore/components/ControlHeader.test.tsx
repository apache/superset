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
  fireEvent,
} from 'spec/helpers/testing-library';
import ControlHeader from './ControlHeader';

const description = 'This control filters the whole chart.';

test('does not render the description icon until the control is hovered', () => {
  const { rerender } = render(
    <ControlHeader
      name="time_range"
      label="Date Range"
      description={description}
    />,
  );

  expect(
    screen.queryByRole('button', { name: 'Show info tooltip' }),
  ).not.toBeInTheDocument();

  rerender(
    <ControlHeader
      name="time_range"
      label="Date Range"
      description={description}
      hovered
    />,
  );

  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();
});

test('notifies onDescriptionHoverChange when the info icon is hovered', async () => {
  const onDescriptionHoverChange = jest.fn();
  render(
    <ControlHeader
      name="time_range"
      label="Date Range"
      description={description}
      hovered
      onDescriptionHoverChange={onDescriptionHoverChange}
    />,
  );

  const infoIcon = screen.getByRole('button', { name: 'Show info tooltip' });
  await userEvent.hover(infoIcon);
  expect(onDescriptionHoverChange).toHaveBeenCalledWith(true);

  await userEvent.unhover(infoIcon);
  expect(onDescriptionHoverChange).toHaveBeenCalledWith(false);
});

test('notifies onDescriptionHoverChange when the info icon is focused', () => {
  const onDescriptionHoverChange = jest.fn();
  render(
    <ControlHeader
      name="time_range"
      label="Date Range"
      description={description}
      hovered
      onDescriptionHoverChange={onDescriptionHoverChange}
    />,
  );

  const infoIcon = screen.getByRole('button', { name: 'Show info tooltip' });
  fireEvent.focus(infoIcon);
  expect(onDescriptionHoverChange).toHaveBeenCalledWith(true);

  fireEvent.blur(infoIcon);
  expect(onDescriptionHoverChange).toHaveBeenCalledWith(false);
});

test('activates tooltipOnClick from the keyboard', () => {
  const tooltipOnClick = jest.fn();
  render(
    <ControlHeader
      name="time_range"
      label="Date Range"
      description={description}
      hovered
      tooltipOnClick={tooltipOnClick}
    />,
  );

  fireEvent.keyDown(screen.getByRole('button', { name: 'Show info tooltip' }), {
    key: 'Enter',
  });
  expect(tooltipOnClick).toHaveBeenCalledTimes(1);
});
