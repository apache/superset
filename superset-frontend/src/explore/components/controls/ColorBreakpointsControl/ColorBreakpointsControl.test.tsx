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
import ColorBreakpointsControl from '.';
import { ColorBreakpointType, ColorBreakpointsControlProps } from './types';

interface Props extends ColorBreakpointsControlProps {
  name: string;
  label: string;
  value: ColorBreakpointType[];
  onChange: jest.Mock;
  breakpoints: ColorBreakpointType[];
}

const createProps = (): Props => ({
  name: 'ColorBreakpointsControl',
  label: 'Color Breakpoints',
  value: [],
  onChange: jest.fn(),
  breakpoints: [],
  actions: {
    setControlValue: jest.fn(),
  },
  type: 'ColorBreakpointsControl',
});

const renderComponent = (props: Partial<Props> = {}) =>
  render(<ColorBreakpointsControl {...createProps()} {...props} />, {
    useDnd: true,
  });

describe('ColorBreakpointsControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with default props', () => {
    renderComponent();
    expect(screen.getByText('Click to add new breakpoint')).toBeInTheDocument();
  });

  test('should render existing breakpoints', () => {
    const existingBreakpoint: ColorBreakpointType = {
      id: 0,
      color: { r: 255, g: 0, b: 0, a: 1 },
      minValue: 0,
      maxValue: 100,
    };

    renderComponent({ value: [existingBreakpoint] });
    expect(screen.getByText('0 - 100')).toBeInTheDocument();
  });

  test('should handle empty breakpoints array', () => {
    renderComponent({ value: [] });
    expect(screen.getByText('Click to add new breakpoint')).toBeInTheDocument();
  });

  test('should handle multiple breakpoints', () => {
    const breakpoints: ColorBreakpointType[] = [
      {
        id: 0,
        color: { r: 255, g: 0, b: 0, a: 1 },
        minValue: 0,
        maxValue: 50,
      },
      {
        id: 1,
        color: { r: 0, g: 255, b: 0, a: 1 },
        minValue: 50,
        maxValue: 100,
      },
    ];

    renderComponent({ value: breakpoints });
    expect(screen.getByText('0 - 50')).toBeInTheDocument();
    expect(screen.getByText('50 - 100')).toBeInTheDocument();
  });

  test('should call onChange when component state updates', () => {
    const onChange = jest.fn();
    renderComponent({ onChange });

    expect(onChange).toHaveBeenCalledWith([]);
  });

  test('should show new breakpoint button when no breakpoints exist', () => {
    renderComponent();
    const ghostButton = screen.getByText('Click to add new breakpoint');
    expect(ghostButton).toBeInTheDocument();
  });

  test('should handle new breakpoint button click and popover visibility state', async () => {
    renderComponent();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const addButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(addButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('should save new breakpoint and update state', async () => {
    const onChange = jest.fn();
    renderComponent({ onChange });

    const addButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(addButton);

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

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          minValue: 10,
          maxValue: 90,
          id: 0,
        }),
      ]),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('should remove breakpoint when delete is triggered', async () => {
    const existingBreakpoint: ColorBreakpointType = {
      id: 0,
      color: { r: 255, g: 0, b: 0, a: 1 },
      minValue: 0,
      maxValue: 100,
    };
    const onChange = jest.fn();

    renderComponent({ value: [existingBreakpoint], onChange });

    const removeButton = screen.getByTestId('remove-control-button');
    userEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  test('should edit existing breakpoint when clicked', async () => {
    const existingBreakpoint: ColorBreakpointType = {
      id: 0,
      color: { r: 255, g: 0, b: 0, a: 1 },
      minValue: 0,
      maxValue: 100,
    };
    const onChange = jest.fn();

    renderComponent({ value: [existingBreakpoint], onChange });

    const breakpointOption = screen.getByText('0 - 100');
    userEvent.click(breakpointOption);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  test('should handle DndSelectLabel props correctly', () => {
    renderComponent();

    const dndSelectLabel = screen
      .getByText('Click to add new breakpoint')
      .closest('div');
    expect(dndSelectLabel).toBeInTheDocument();
  });

  test('should assign incremental IDs to new breakpoints', async () => {
    const onChange = jest.fn();
    renderComponent({ onChange });

    const addButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(addButton);

    const minInput = screen.getByTestId('min-value-input');
    const maxInput = screen.getByTestId('max-value-input');

    userEvent.type(minInput, '0');
    userEvent.type(maxInput, '50');

    await waitFor(() => {
      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeEnabled();
    });

    const saveButton = screen.getByTestId('save-button');
    userEvent.click(saveButton);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 0 })]);
  });
});
