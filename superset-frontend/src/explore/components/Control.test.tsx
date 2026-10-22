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
import {
  CustomControlItem,
  ControlPanelsContainerProps,
  ControlState,
} from '@superset-ui/chart-controls';
import sunburstPanel from '../../../plugins/plugin-chart-echarts/src/Sunburst/controlPanel';
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

test('forwards child control changes through setControlValue', async () => {
  const setControlValue = jest.fn();
  render(setup({ actions: { setControlValue } }));

  await userEvent.click(screen.getByRole('checkbox'));

  expect(setControlValue).toHaveBeenCalledWith(
    'checkbox',
    false,
    undefined,
    undefined,
  );
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

test('marks hiding a control as a programmatic value reset', async () => {
  const setControlValue = jest.fn();
  const { rerender } = render(
    setup({
      actions: { setControlValue },
      isVisible: true,
      value: true,
      default: false,
    }),
  );

  expect(setControlValue).not.toHaveBeenCalled();
  rerender(
    setup({
      actions: { setControlValue },
      isVisible: false,
      value: true,
      default: false,
    }),
  );
  await waitFor(() =>
    expect(setControlValue).toHaveBeenCalledWith('checkbox', false, undefined, {
      programmatic: true,
    }),
  );
});

test('keeps description help available before and after hover', async () => {
  render(
    setup({
      label: 'My checkbox',
      description: 'Help text',
    }),
  );

  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

  await userEvent.hover(screen.getByTestId('checkbox'));
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

  await userEvent.unhover(screen.getByTestId('checkbox'));
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();
});

test('keeps description help available across input and help focus', () => {
  render(
    setup({
      label: 'My checkbox',
      description: 'Help text',
    }),
  );

  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

  fireEvent.focus(screen.getByRole('checkbox'));
  const infoIcon = screen.getByRole('button', { name: 'Show info tooltip' });
  expect(infoIcon).toBeInTheDocument();

  fireEvent.blur(screen.getByRole('checkbox'), { relatedTarget: infoIcon });
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();

  fireEvent.blur(infoIcon, { relatedTarget: document.body });
  expect(
    screen.getByRole('button', { name: 'Show info tooltip' }),
  ).toBeInTheDocument();
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

test('hiding the Sunburst grain control clears the saved grain', async () => {
  const grain = sunburstPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(
      item => (item as CustomControlItem)?.name === 'time_grain_sqla',
    ) as CustomControlItem;
  const setControlValue = jest.fn();
  const control = (isVisible: boolean) => (
    <Control
      {...defaultProps}
      name="time_grain_sqla"
      type="TextControl"
      value="P1M"
      default={grain.config.default}
      isVisible={isVisible}
      actions={{ setControlValue }}
    />
  );
  const { rerender } = render(control(true));
  rerender(control(false));
  await waitFor(() =>
    expect(setControlValue).toHaveBeenCalledWith(
      'time_grain_sqla',
      null,
      undefined,
      { programmatic: true },
    ),
  );
});

test('removing an MCP temporal level clears its hidden Time Column subject', async () => {
  const subject = sunburstPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(
      item => (item as CustomControlItem)?.name === 'granularity_sqla',
    ) as CustomControlItem;
  const isVisible = (columns: string[]) =>
    subject.config.visibility
      ? (
          subject.config.visibility as (
            props: ControlPanelsContainerProps,
            control: ControlState,
          ) => boolean
        )(
          {
            controls: { columns: { value: columns } },
          } as unknown as ControlPanelsContainerProps,
          { value: 'order_date' } as ControlState,
        )
      : true;
  const setControlValue = jest.fn();
  const control = (columns: string[]) => (
    <Control
      {...defaultProps}
      name="granularity_sqla"
      type="TextControl"
      value="order_date"
      default={subject.config.default}
      hidden
      isVisible={isVisible(columns)}
      actions={{ setControlValue }}
    />
  );
  const { rerender } = render(control(['order_date', 'region']));
  rerender(control(['ship_date', 'region']));
  await waitFor(() =>
    expect(setControlValue).toHaveBeenCalledWith(
      'granularity_sqla',
      null,
      undefined,
      { programmatic: true },
    ),
  );
});
