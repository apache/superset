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
  waitFor,
  userEvent,
  fireEvent,
} from 'spec/helpers/testing-library';
import Control, { ControlProps } from 'src/explore/components/Control';

const defaultProps: ControlProps = {
  type: 'CheckboxControl',
  name: 'checkbox',
  value: true,
  actions: {
    setControlValue: jest.fn(),
  },
};

const setup = (overrides = {}) => <Control {...defaultProps} {...overrides} />;

test('render a control', () => {
  render(setup());

  const checkbox = screen.getByRole('checkbox');
  expect(checkbox).toBeInTheDocument();
});

test('render null if type is not exit', () => {
  render(
    setup({
      type: undefined,
    }),
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

test('render null if type is not valid', () => {
  render(
    setup({
      type: 'UnknownControl',
    }),
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

test('render null if isVisible is false', () => {
  render(
    setup({
      isVisible: false,
    }),
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

test('call setControlValue if isVisible is false', async () => {
  const { rerender } = render(
    setup({
      isVisible: true,
      default: false,
    }),
  );
  expect(defaultProps.actions.setControlValue).not.toHaveBeenCalled();
  rerender(setup({ isVisible: false, default: false }));
  await waitFor(() =>
    expect(defaultProps.actions.setControlValue).toHaveBeenCalled(),
  );
});

test('shows the description icon while the control is hovered', async () => {
  render(
    setup({
      label: 'My checkbox',
      description: 'Help text',
    }),
  );

  expect(
    screen.queryByRole('button', { name: 'Show info tooltip' }),
  ).not.toBeInTheDocument();

  await userEvent.hover(screen.getByTestId('checkbox'));
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

  await userEvent.unhover(screen.getByTestId('checkbox'));
  expect(
    screen.queryByRole('button', { name: 'Show info tooltip' }),
  ).not.toBeInTheDocument();
});

test('shows the description icon while the control has keyboard focus', () => {
  render(
    setup({
      label: 'My checkbox',
      description: 'Help text',
    }),
  );

  expect(
    screen.queryByRole('button', { name: 'Show info tooltip' }),
  ).not.toBeInTheDocument();

  fireEvent.focus(screen.getByRole('checkbox'));
  const infoIcon = screen.getByRole('button', { name: 'Show info tooltip' });
  expect(infoIcon).toBeInTheDocument();

  fireEvent.blur(screen.getByRole('checkbox'), { relatedTarget: infoIcon });
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

  fireEvent.blur(infoIcon, { relatedTarget: document.body });
  expect(
    screen.queryByRole('button', { name: 'Show info tooltip' }),
  ).not.toBeInTheDocument();
});

test('keeps the description icon visible when the pointer leaves a focused control', () => {
  render(
    setup({
      label: 'My checkbox',
      description: 'Help text',
    }),
  );

  fireEvent.focus(screen.getByRole('checkbox'));
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

  fireEvent.mouseLeave(screen.getByTestId('checkbox'));
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();
});
