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
import ColorBreakpointOption from './ColorBreakpointOption';
import { ColorBreakpointType, ColorBreakpointOptionProps } from './types';

const mockBreakpoint: ColorBreakpointType = {
  id: 0,
  color: { r: 255, g: 0, b: 0, a: 1 },
  minValue: 0,
  maxValue: 100,
};

const mockBreakpoints: ColorBreakpointType[] = [mockBreakpoint];

const createProps = (): ColorBreakpointOptionProps => ({
  breakpoint: mockBreakpoint,
  colorBreakpoints: mockBreakpoints,
  index: 0,
  saveColorBreakpoint: jest.fn(),
  onClose: jest.fn(),
  onShift: jest.fn(),
});

const renderComponent = (props: Partial<ColorBreakpointOptionProps> = {}) =>
  render(<ColorBreakpointOption {...createProps()} {...props} />, {
    useDnd: true,
  });

describe('ColorBreakpointOption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render', async () => {
    const { container } = renderComponent();
    await waitFor(() => expect(container).toBeInTheDocument());
  });

  test('should render the breakpoint range text', async () => {
    renderComponent();
    expect(await screen.findByText('0 - 100')).toBeInTheDocument();
  });

  test('should render the remove button', async () => {
    renderComponent();
    const removeBtn = await screen.findByTestId('remove-control-button');
    expect(removeBtn).toBeInTheDocument();
  });

  test('should render the color preview', async () => {
    renderComponent();
    const colorPreview = await screen.findByTestId('color-preview');
    expect(colorPreview).toBeInTheDocument();
  });

  test('should call onClose when remove button is clicked', async () => {
    const onClose = jest.fn();
    renderComponent({ onClose });

    const removeBtn = await screen.findByTestId('remove-control-button');
    userEvent.click(removeBtn);

    expect(onClose).toHaveBeenCalledWith(0);
  });

  test('should open popover when clicked', async () => {
    renderComponent();

    const breakpointOption = await screen.findByTestId(
      'color-breakpoint-trigger',
    );
    userEvent.click(breakpointOption);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('should render different color values correctly', async () => {
    const blueBreakpoint: ColorBreakpointType = {
      id: 1,
      color: { r: 0, g: 0, b: 255, a: 1 },
      minValue: 50,
      maxValue: 150,
    };

    renderComponent({ breakpoint: blueBreakpoint });
    expect(await screen.findByText('50 - 150')).toBeInTheDocument();

    const colorPreview = await screen.findByTestId('color-preview');
    expect(colorPreview).toBeInTheDocument();
  });

  test('should handle decimal values', async () => {
    const decimalBreakpoint: ColorBreakpointType = {
      id: 2,
      color: { r: 128, g: 128, b: 128, a: 1 },
      minValue: 0.5,
      maxValue: 99.9,
    };

    renderComponent({ breakpoint: decimalBreakpoint });
    expect(await screen.findByText('0.5 - 99.9')).toBeInTheDocument();
  });
});
