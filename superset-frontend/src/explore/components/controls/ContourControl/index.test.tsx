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
  sleep,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { Constants } from '@superset-ui/core/components';
import ContourControl from '.';
import { ContourType } from './types';

// Alpha is 100 because ContourPopoverControl forces it on every picked color
// (see `updateColor`), so fixtures match what the popover emits.
const magenta = { r: 255, g: 0, b: 255, a: 100 };
const green = { r: 0, g: 255, b: 0, a: 100 };

const isoline: ContourType = {
  lowerThreshold: 4,
  color: magenta,
  strokeWidth: 1,
  zIndex: 10,
};

const isoband: ContourType = {
  lowerThreshold: 6,
  upperThreshold: 10,
  color: green,
  zIndex: 20,
};

const isolineLabel =
  'Threshold: 4, color: rgba(255, 0, 255, 1), stroke width: 1';
const isobandLabel = 'Threshold: [6, 10], color: rgba(0, 255, 0, 1)';

const renderControl = (value?: ContourType[]) => {
  const onChange = jest.fn();
  render(
    <ContourControl
      name="contours"
      label="Contours"
      // ContourControl is not a member of the ControlType union; the prop is
      // required by the shared control props but unused by the component.
      type="BoundsControl"
      actions={{ setControlValue: jest.fn() }}
      value={value}
      onChange={onChange}
    />,
    { useDnd: true },
  );
  return { onChange };
};

const lastChange = (onChange: jest.Mock): ContourType[] =>
  onChange.mock.calls.at(-1)?.[0] ?? [];

// Lets the popover's debounced field change flush before the next interaction.
const flushDebounce = () => sleep(Constants.FAST_DEBOUNCE + 100);

const fields = () =>
  screen.getAllByTestId('inline-name').map(el => {
    if (!(el instanceof HTMLInputElement)) {
      throw new Error('expected inline-name to be an input element');
    }
    return el;
  });

const pickColor = async () => {
  const trigger = await waitFor(() => {
    const el = document.querySelector('.ant-color-picker-trigger');
    if (!el) throw new Error('no color picker trigger');
    return el as HTMLElement;
  });
  await userEvent.click(trigger);
  const preset = await waitFor(() => {
    const el = document.querySelector('.ant-color-picker-presets-color');
    if (!el) throw new Error('no color preset');
    return el as HTMLElement;
  });
  await userEvent.click(preset);
};

test('renders the default contours when no value is provided', () => {
  renderControl();
  // ContourControl ships three default contours (DEFAULT_CONTOURS in index.tsx,
  // not exported).
  expect(screen.getAllByTestId('option-label')).toHaveLength(3);
});

test('renders one option per contour in the provided value', () => {
  renderControl([isoline, isoband]);
  expect(screen.getByText(isolineLabel)).toBeInTheDocument();
  expect(screen.getByText(isobandLabel)).toBeInTheDocument();
});

test('reports the contours with a z-index that follows their order', () => {
  const { onChange } = renderControl([isoband, isoline]);
  expect(lastChange(onChange)).toEqual([
    expect.objectContaining({
      lowerThreshold: 6,
      upperThreshold: 10,
      zIndex: 10,
    }),
    expect.objectContaining({ lowerThreshold: 4, zIndex: 20 }),
  ]);
});

test('opens the add popover from the ghost button', async () => {
  renderControl([]);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('Click to add a contour'));

  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('adds an isoline and reports it after the existing contours', async () => {
  const { onChange } = renderControl([isoband]);

  await userEvent.click(screen.getByText('Click to add a contour'));
  await screen.findByRole('tooltip');
  await userEvent.type(fields()[0], '3');
  await flushDebounce();
  await userEvent.type(fields()[1], '2');
  await flushDebounce();
  await pickColor();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(lastChange(onChange)).toHaveLength(2));
  expect(lastChange(onChange)[0]).toEqual(
    expect.objectContaining({ lowerThreshold: 6, upperThreshold: 10 }),
  );
  expect(lastChange(onChange)[1]).toEqual(
    expect.objectContaining({ lowerThreshold: 3, strokeWidth: 2, zIndex: 20 }),
  );
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('edits a contour in place through its popover', async () => {
  const { onChange } = renderControl([isoline, isoband]);

  await userEvent.click(screen.getByText(isobandLabel));
  // Hovering the option also opens its summary tooltip (role "tooltip"), so
  // wait on the edit popover's tab rather than on a tooltip role.
  await screen.findByRole('tab', { name: 'Isoband' });
  const input = fields()[0];
  await userEvent.clear(input);
  await userEvent.type(input, '5');
  await flushDebounce();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      expect.objectContaining({ lowerThreshold: 4, zIndex: 10 }),
      expect.objectContaining({
        lowerThreshold: 5,
        upperThreshold: 10,
        zIndex: 20,
      }),
    ]),
  );
  expect(
    screen.getByText('Threshold: [5, 10], color: rgba(0, 255, 0, 1)'),
  ).toBeInTheDocument();
});

test('removes a contour with its remove button', async () => {
  const { onChange } = renderControl([isoline, isoband]);

  await userEvent.click(screen.getAllByTestId('remove-control-button')[0]);

  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      expect.objectContaining({
        lowerThreshold: 6,
        upperThreshold: 10,
        zIndex: 10,
      }),
    ]),
  );
  expect(screen.queryByText(isolineLabel)).not.toBeInTheDocument();
  expect(screen.getByText(isobandLabel)).toBeInTheDocument();
});

test('removing the last contour reports an empty list', async () => {
  const { onChange } = renderControl([isoline]);

  await userEvent.click(screen.getByTestId('remove-control-button'));

  await waitFor(() => expect(lastChange(onChange)).toEqual([]));
});
