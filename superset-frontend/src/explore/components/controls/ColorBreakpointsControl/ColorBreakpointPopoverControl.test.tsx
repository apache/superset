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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import ColorBreakpointPopoverControl from './ColorBreakpointPopoverControl';
import {
  ColorBreakpointType,
  ColorBreakpointsPopoverControlProps,
} from './types';

const mockBreakpoint: ColorBreakpointType = {
  id: 0,
  color: { r: 255, g: 0, b: 0, a: 100 },
  minValue: 0,
  maxValue: 100,
};

const mockBreakpoints: ColorBreakpointType[] = [mockBreakpoint];

// Couldn't test the color select - providing color instead of interacting with the color select component
const mockEmptyBreakpoint: ColorBreakpointType = {
  id: 0,
  color: { r: 0, g: 0, b: 0, a: 0 },
};

const createProps = (): ColorBreakpointsPopoverControlProps => ({
  value: mockBreakpoint,
  onSave: jest.fn(),
  onClose: jest.fn(),
  colorBreakpoints: mockBreakpoints,
});

const renderComponent = (
  props: Partial<ColorBreakpointsPopoverControlProps> = {},
) => render(<ColorBreakpointPopoverControl {...createProps()} {...props} />);

describe('ColorBreakpointPopoverControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render with default props', () => {
    renderComponent();

    expect(screen.getByText('Color for breakpoint')).toBeInTheDocument();
    expect(screen.getByText('Min value')).toBeInTheDocument();
    expect(screen.getByText('Max value')).toBeInTheDocument();
  });

  test('should render close and save buttons', () => {
    renderComponent();

    expect(screen.getByTestId('close-button')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  test('should render with existing breakpoint values', () => {
    renderComponent();

    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  test('should call onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    renderComponent({ onClose });

    const closeButton = screen.getByTestId('close-button');
    userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  test('should disable save button when form is incomplete', () => {
    renderComponent({ value: undefined });

    const saveButton = screen.getByTestId('save-button');
    expect(saveButton).toBeDisabled();
  });

  test('should enable save button when form is complete', async () => {
    renderComponent({ value: mockEmptyBreakpoint });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '10');
    userEvent.type(maxInput, '90');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeEnabled();
    });
  });

  test('should call onSave with correct values when save button is clicked', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();

    renderComponent({
      onSave,
      onClose,
      value: mockEmptyBreakpoint,
    });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '10');
    userEvent.type(maxInput, '90');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeEnabled();
    });

    const saveButton = screen.getByTestId('save-button');
    userEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        minValue: 10,
        maxValue: 90,
        color: expect.objectContaining({
          r: expect.any(Number),
          g: expect.any(Number),
          b: expect.any(Number),
          a: expect.any(Number),
        }),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('should disable save button when min value >= max value', async () => {
    renderComponent({ value: undefined });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '100');
    userEvent.type(maxInput, '50');

    const saveButton = screen.getByTestId('save-button');
    expect(saveButton).toBeDisabled();
  });

  test('should disable save button when breakpoint overlaps with existing ones', async () => {
    const existingBreakpoints: ColorBreakpointType[] = [
      {
        id: 0,
        color: { r: 255, g: 0, b: 0, a: 100 },
        minValue: 0,
        maxValue: 50,
      },
      {
        id: 1,
        color: { r: 0, g: 255, b: 0, a: 100 },
        minValue: 100,
        maxValue: 200,
      },
    ];

    renderComponent({
      colorBreakpoints: existingBreakpoints,
      value: undefined,
    });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '25');
    userEvent.type(maxInput, '75');

    const saveButton = screen.getByTestId('save-button');
    expect(saveButton).toBeDisabled();
  });

  test('should handle non-numeric input validation', async () => {
    renderComponent({ value: undefined });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, 'abc');
    userEvent.type(maxInput, '100');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeDisabled();
    });
  });

  test('should update min value when input changes', async () => {
    renderComponent();

    const minInput = screen.getByDisplayValue('0');
    userEvent.clear(minInput);
    userEvent.type(minInput, '20');

    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
  });

  test('should update max value when input changes', async () => {
    renderComponent();

    const maxInput = screen.getByDisplayValue('100');
    userEvent.clear(maxInput);
    userEvent.type(maxInput, '200');

    expect(screen.getByDisplayValue('200')).toBeInTheDocument();
  });

  test('should handle zero values correctly', async () => {
    renderComponent({
      value: mockEmptyBreakpoint,
    });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '0');
    userEvent.type(maxInput, '10');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeEnabled();
    });
  });

  test('should handle negative values correctly', async () => {
    renderComponent({
      value: mockEmptyBreakpoint,
    });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '-10');
    userEvent.type(maxInput, '10');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeEnabled();
    });
  });

  test('should handle decimal values correctly', async () => {
    renderComponent({
      value: mockEmptyBreakpoint,
    });

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '0.5');
    userEvent.type(maxInput, '99.9');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeEnabled();
    });
  });

  test('should not show overlap error when editing existing breakpoint', async () => {
    const existingBreakpoints: ColorBreakpointType[] = [
      {
        id: 0,
        color: { r: 255, g: 0, b: 0, a: 100 },
        minValue: 0,
        maxValue: 50,
      },
      {
        id: 1,
        color: { r: 0, g: 255, b: 0, a: 100 },
        minValue: 100,
        maxValue: 200,
      },
    ];

    const editingBreakpoint = existingBreakpoints[0];
    renderComponent({
      colorBreakpoints: existingBreakpoints,
      value: editingBreakpoint,
    });

    const minInput = screen.getByDisplayValue('0');
    userEvent.clear(minInput);
    userEvent.type(minInput, '10');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeEnabled();
    });
  });
});
