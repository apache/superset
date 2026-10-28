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
  waitFor,
} from 'spec/helpers/testing-library';
import ControlHeader from './ControlHeader';
import SelectControl from './controls/SelectControl';

const description = 'This control filters the whole chart.';

test('instant-effect notice requires hover while description help remains available', () => {
  const { rerender } = render(
    <ControlHeader
      name="my-control"
      label="My control"
      description={description}
      renderTrigger
      hovered={false}
    />,
  );
  expect(screen.queryByTestId('info-tooltip-icon')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();
  rerender(
    <ControlHeader
      name="my-control"
      label="My control"
      description={description}
      renderTrigger
      hovered
    />,
  );
  expect(screen.getByTestId('info-tooltip-icon')).toBeInTheDocument();
  expect(screen.getByTestId('my-control-description-icon')).toBeInTheDocument();
});

test('noninteractive labels do not add a dead keyboard stop', () => {
  render(<ControlHeader name="time_range" label="Date Range" />);

  const label = screen.getByText('Date Range');
  expect(label).not.toHaveAttribute('role');
  expect(label).not.toHaveAttribute('aria-disabled');
  expect(label).not.toHaveAttribute('tabindex');
});

test('interactive labels remain keyboard-accessible buttons', () => {
  const onClick = jest.fn();
  render(<ControlHeader label="Toggle option" onClick={onClick} />);
  const label = screen.getByRole('button', { name: 'Toggle option' });
  expect(label).toHaveAttribute('tabindex', '0');
  expect(label).not.toHaveAttribute('aria-disabled');
  fireEvent.keyDown(label, { key: 'Enter' });
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('keeps the description icon available without hover', () => {
  const { rerender } = render(
    <ControlHeader
      name="time_range"
      label="Date Range"
      description={description}
    />,
  );

  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

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

test('renders description icon outside label when hovered', async () => {
  render(
    <ControlHeader
      name="time_range"
      label="Date Range"
      description={description}
      hovered
    />,
  );
  const label = screen.getByText('Date Range');
  const infoIcon = screen.getByRole('button', { name: 'Show info tooltip' });
  expect(infoIcon).toBeInTheDocument();
  expect(infoIcon.tagName).toBe('BUTTON');
  // Ensure info icon is not a descendant of FormLabel / label
  const formLabel = label.closest('label');
  expect(formLabel).not.toContainElement(infoIcon);
});

test('disabled selects keep their description reachable by keyboard without a header tab stop', async () => {
  render(
    <SelectControl
      name="server_page_length"
      label="Server Page Length"
      description={description}
      disabled
      choices={[[10, '10']]}
      value={10}
    />,
  );
  expect(screen.getByText('Server Page Length')).not.toHaveAttribute(
    'tabindex',
  );
  await userEvent.tab();
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toHaveFocus();
  expect(await screen.findByRole('tooltip')).toHaveTextContent(description);
});

test('description help stays associated with its own control after focus moves', async () => {
  render(
    <>
      <ControlHeader label="First control" description="First help" />
      <ControlHeader label="Second control" description="Second help" />
    </>,
  );
  const buttons = screen.getAllByRole('button', { name: 'Show info tooltip' });
  await userEvent.tab();
  expect(await screen.findByRole('tooltip')).toHaveTextContent('First help');
  expect(buttons[0]).toHaveAccessibleDescription('First help');
  await userEvent.tab();
  await waitFor(() =>
    expect(buttons[1]).toHaveAccessibleDescription('Second help'),
  );
});
