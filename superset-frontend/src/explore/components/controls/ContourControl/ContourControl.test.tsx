/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with work for additional information
 * regarding copyright ownership.  The ASF licenses file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use file except in compliance
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
import ContourOption from './ContourOption';
import ContourPopoverControl from './ContourPopoverControl';
import { ContourType } from './types';

const color = { r: 30, g: 120, b: 200, a: 100 };
const renderContour = (contour: ContourType, onSave = jest.fn()) =>
  render(
    <>
      <ContourOption
        contour={contour}
        index={0}
        saveContour={onSave}
        onClose={jest.fn()}
        onShift={jest.fn()}
      />
      <ContourPopoverControl value={contour} onSave={onSave} />
    </>,
    { useDnd: true },
  );

test.each([
  [-1, 0],
  [0, 1],
  [1, 2],
])(
  'preserves isoband [%s, %s] without a stroke width',
  async (lowerThreshold, upperThreshold) => {
    const onSave = jest.fn();
    renderContour({ color, lowerThreshold, upperThreshold }, onSave);
    expect(
      screen.getByText(
        `Threshold: [${lowerThreshold}, ${upperThreshold}], color: rgba(30, 120, 200, 1)`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Isoband' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByDisplayValue(String(lowerThreshold)),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(String(upperThreshold)),
    ).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ lowerThreshold, upperThreshold }),
    );
  },
);

test.each([
  [0, 0],
  [0, -1],
  [1, 0],
])('rejects isoband [%s, %s]', async (lowerThreshold, upperThreshold) => {
  render(
    <ContourPopoverControl value={{ color, lowerThreshold, upperThreshold }} />,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
  );
});

test('preserves a zero isoline threshold when the unused upper threshold is NaN', async () => {
  const onSave = jest.fn();
  renderContour(
    { color, lowerThreshold: 0, upperThreshold: NaN, strokeWidth: 2 },
    onSave,
  );
  expect(
    screen.getByText(
      'Threshold: 0, color: rgba(30, 120, 200, 1), stroke width: 2',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Isoline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ lowerThreshold: 0, strokeWidth: 2 }),
  );
});

test('treats an upper threshold without a lower threshold as incomplete in both label and editor', () => {
  renderContour({ color, upperThreshold: 0, strokeWidth: 2 });
  expect(
    screen.getByText(
      'Threshold: -1, color: rgba(30, 120, 200, 1), stroke width: 2',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Isoline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});
