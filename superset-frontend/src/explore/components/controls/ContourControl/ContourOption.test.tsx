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
import ContourOption from './ContourOption';
import { ContourOptionProps, ContourType } from './types';

const color = { r: 10, g: 20, b: 30, a: 100 };

const isoline: ContourType = {
  lowerThreshold: 4,
  color,
  strokeWidth: 3,
  zIndex: 10,
};

const isoband: ContourType = {
  lowerThreshold: 6,
  upperThreshold: 10,
  color,
  zIndex: 20,
};

const renderOption = (props: Partial<ContourOptionProps> = {}) => {
  const handlers = {
    saveContour: jest.fn(),
    onClose: jest.fn(),
    onShift: jest.fn(),
  };
  render(
    <ContourOption contour={isoline} index={0} {...handlers} {...props} />,
    { useDnd: true },
  );
  return handlers;
};

test('labels an isoline with its threshold, color and stroke width', () => {
  renderOption({ contour: isoline });
  expect(
    screen.getByText(
      'Threshold: 4, color: rgba(10, 20, 30, 1), stroke width: 3',
    ),
  ).toBeInTheDocument();
});

test('labels an isoband with its threshold range and color but no stroke width', () => {
  renderOption({ contour: isoband });
  expect(
    screen.getByText('Threshold: [6, 10], color: rgba(10, 20, 30, 1)'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/stroke width/)).not.toBeInTheDocument();
});

test('treats a contour with an upper threshold as an isoband', () => {
  renderOption({ contour: { ...isoline, upperThreshold: 8 } });
  expect(screen.getByText(/Threshold: \[4, 8\]/)).toBeInTheDocument();
});

test('treats a contour without an upper threshold as an isoline', () => {
  renderOption({
    contour: { ...isoband, upperThreshold: undefined, strokeWidth: 2 },
  });
  expect(screen.getByText(/stroke width: 2/)).toBeInTheDocument();
});

test('calls onClose with the option index when removed', async () => {
  const { onClose } = renderOption({ index: 2 });

  await userEvent.click(screen.getByTestId('remove-control-button'));

  expect(onClose).toHaveBeenCalledWith(2);
});

test('opens the contour popover prefilled from the contour when clicked', async () => {
  renderOption({ contour: isoband });

  await userEvent.click(screen.getByTestId('option-label'));

  expect(await screen.findByRole('tab', { name: 'Isoband' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const inputs = screen.getAllByTestId('inline-name') as HTMLInputElement[];
  expect(inputs.map(input => input.value)).toEqual(['6', '10']);
});

test('saves the prefilled contour values unchanged through saveContour', async () => {
  const { saveContour } = renderOption({ contour: isoline });

  await userEvent.click(screen.getByTestId('option-label'));
  await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

  expect(saveContour).toHaveBeenCalledWith(
    expect.objectContaining({ lowerThreshold: 4, strokeWidth: 3, color }),
  );
});
