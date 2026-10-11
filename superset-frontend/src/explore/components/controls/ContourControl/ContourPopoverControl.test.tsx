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
  within,
} from 'spec/helpers/testing-library';
import { Constants } from '@superset-ui/core/components';
import ContourPopoverControl from './ContourPopoverControl';
import { ContourType } from './types';

const color = { r: 255, g: 0, b: 255, a: 100 };

const isoline: ContourType = {
  lowerThreshold: 4,
  color,
  strokeWidth: 2,
  zIndex: 10,
};

const isoband: ContourType = {
  lowerThreshold: 6,
  upperThreshold: 10,
  color,
  zIndex: 20,
};

const renderControl = (value?: ContourType) => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <ContourPopoverControl value={value} onSave={onSave} onClose={onClose} />,
  );
  return { onSave, onClose };
};

const saveButton = () => screen.getByRole('button', { name: 'Save' });

// Only the active tab's pane is exposed to the accessibility tree.
const fields = () =>
  within(screen.getByRole('tabpanel')).getAllByTestId(
    'inline-name',
  ) as HTMLInputElement[];

// The text inputs debounce before updating the contour state, so wait for
// each edit to land before making the next one.
const setField = async (index: number, text: string) => {
  const input = fields()[index];
  await userEvent.clear(input);
  if (text) await userEvent.type(input, text);
  await sleep(Constants.FAST_DEBOUNCE + 100);
};

test('opens on the Isoline tab for a contour without an upper threshold', () => {
  renderControl(isoline);
  expect(screen.getByRole('tab', { name: 'Isoline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByText('Stroke Width')).toBeInTheDocument();
});

test('opens on the Isoband tab for a contour with an upper threshold', () => {
  renderControl(isoband);
  expect(screen.getByRole('tab', { name: 'Isoband' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByText('Upper Threshold')).toBeInTheDocument();
});

test('opens on the Isoline tab when creating a new contour', () => {
  renderControl();
  expect(screen.getByRole('tab', { name: 'Isoline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('prefills the fields from the contour being edited', () => {
  renderControl(isoline);
  expect(fields().map(input => input.value)).toEqual(['4', '2']);
});

// An absent field is coerced with Number(), so the saved value is NaN rather
// than undefined. Consumers only rely on it being falsy.
test('saves an isoline without an upper threshold', async () => {
  const { onSave, onClose } = renderControl(isoline);

  await userEvent.click(saveButton());

  const saved = onSave.mock.calls[0][0];
  expect(saved).toEqual(
    expect.objectContaining({ color, lowerThreshold: 4, strokeWidth: 2 }),
  );
  expect(saved.upperThreshold).toBeFalsy();
  expect(onClose).toHaveBeenCalled();
});

test('saves an isoband without a stroke width', async () => {
  const { onSave, onClose } = renderControl(isoband);

  await userEvent.click(saveButton());

  const saved = onSave.mock.calls[0][0];
  expect(saved).toEqual(
    expect.objectContaining({ color, lowerThreshold: 6, upperThreshold: 10 }),
  );
  expect(saved.strokeWidth).toBeFalsy();
  expect(onClose).toHaveBeenCalled();
});

test('saves the thresholds as numbers after editing', async () => {
  const { onSave } = renderControl(isoband);

  await setField(0, '7');
  await setField(1, '12');
  await userEvent.click(saveButton());

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ lowerThreshold: 7, upperThreshold: 12 }),
  );
});

test('saves as an isoband when an isoline is switched to the Isoband tab', async () => {
  const { onSave } = renderControl(isoline);

  await userEvent.click(screen.getByRole('tab', { name: 'Isoband' }));
  await setField(1, '9');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());

  const saved = onSave.mock.calls[0][0];
  expect(saved).toEqual(
    expect.objectContaining({ lowerThreshold: 4, upperThreshold: 9 }),
  );
  expect(saved.strokeWidth).toBeFalsy();
});

test('saves as an isoline when an isoband is switched to the Isoline tab', async () => {
  const { onSave } = renderControl(isoband);

  await userEvent.click(screen.getByRole('tab', { name: 'Isoline' }));
  await setField(1, '3');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());

  const saved = onSave.mock.calls[0][0];
  expect(saved).toEqual(
    expect.objectContaining({ lowerThreshold: 6, strokeWidth: 3 }),
  );
  expect(saved.upperThreshold).toBeFalsy();
});

test('keeps save disabled until every required isoline field is set', () => {
  renderControl();
  expect(saveButton()).toBeDisabled();
});

test('shows an integer error for a fractional isoline threshold and blocks save', async () => {
  const { onSave } = renderControl(isoline);

  await setField(0, '1.5');

  await waitFor(() => expect(saveButton()).toBeDisabled());
  const badge = await screen.findByTestId('error-tooltip');
  await userEvent.hover(within(badge).getByRole('img'));
  expect(
    await screen.findByText('is expected to be an integer'),
  ).toBeInTheDocument();
  await userEvent.click(saveButton());
  expect(onSave).not.toHaveBeenCalled();
});

test('shows an integer error for a non-numeric stroke width and blocks save', async () => {
  renderControl(isoline);

  await setField(1, 'wide');

  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(await screen.findAllByTestId('error-tooltip')).toHaveLength(1);
});

test('clears the integer error once the value is corrected', async () => {
  renderControl(isoline);

  await setField(0, '1.5');
  await screen.findByTestId('error-tooltip');
  await setField(0, '2');

  await waitFor(() =>
    expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(saveButton()).toBeEnabled());
});

test('flags both isoband thresholds when lower is not below upper', async () => {
  renderControl(isoband);

  await setField(0, '10');

  await waitFor(() =>
    expect(screen.getAllByTestId('error-tooltip')).toHaveLength(2),
  );
  expect(saveButton()).toBeDisabled();
});

test('explains which isoband threshold must be lower or greater', async () => {
  renderControl(isoband);

  await setField(0, '10');

  const badges = await screen.findAllByTestId('error-tooltip');
  await userEvent.hover(within(badges[0]).getByRole('img'));
  expect(
    await screen.findByText(
      'Lower threshold must be lower than upper threshold',
    ),
  ).toBeInTheDocument();
  await userEvent.hover(within(badges[1]).getByRole('img'));
  expect(
    await screen.findByText(
      'Upper threshold must be greater than lower threshold',
    ),
  ).toBeInTheDocument();
});

test('does not allow saving an isoband whose thresholds are equal', async () => {
  const { onSave } = renderControl(isoband);

  await setField(1, '6');

  await waitFor(() =>
    expect(screen.getAllByTestId('error-tooltip')).toHaveLength(2),
  );
  await userEvent.click(saveButton());
  expect(onSave).not.toHaveBeenCalled();
});

test('allows saving an isoband again once lower drops below upper', async () => {
  renderControl(isoband);

  await setField(0, '10');
  await waitFor(() => expect(saveButton()).toBeDisabled());
  await setField(0, '2');

  await waitFor(() => expect(saveButton()).toBeEnabled());
  expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument();
});

test('closes without saving when Close is clicked', async () => {
  const { onSave, onClose } = renderControl(isoline);

  await userEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(onClose).toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
});
