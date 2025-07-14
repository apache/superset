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
import ColorBreakpointPopoverTrigger from './ColorBreakpointPopoverTrigger';
import {
  ColorBreakpointType,
  ColorBreakpointsPopoverTriggerProps,
} from './types';

const mockBreakpoint: ColorBreakpointType = {
  id: 0,
  color: { r: 255, g: 0, b: 0, a: 1 },
  minValue: 0,
  maxValue: 100,
};

// Couldn't test the color select - providing color instead of interacting with the color select component
const mockEmptyBreakpoint: ColorBreakpointType = {
  id: 0,
  color: { r: 0, g: 0, b: 0, a: 0 },
};

const mockBreakpoints: ColorBreakpointType[] = [mockBreakpoint];

const createProps = (): ColorBreakpointsPopoverTriggerProps => ({
  value: mockBreakpoint,
  saveColorBreakpoint: jest.fn(),
  colorBreakpoints: mockBreakpoints,
});

const renderComponent = (
  props: Partial<ColorBreakpointsPopoverTriggerProps> = {},
) =>
  render(
    <ColorBreakpointPopoverTrigger {...createProps()} {...props}>
      Click to add new breakpoint
    </ColorBreakpointPopoverTrigger>,
  );

describe('ColorBreakpointPopoverTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render', () => {
    const { container } = renderComponent();
    expect(container).toBeInTheDocument();
  });

  test('should render children', () => {
    renderComponent();
    expect(screen.getByText('Click to add new breakpoint')).toBeInTheDocument();
  });

  test('should render the popover on click when uncontrolled', async () => {
    renderComponent();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const triggerButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(triggerButton);

    expect(screen.queryByRole('dialog')).toBeInTheDocument();
  });

  test('should be visible when controlled and visible is true', async () => {
    const controlledProps = {
      isControlled: true,
      visible: true,
      toggleVisibility: jest.fn(),
    };

    renderComponent(controlledProps);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  test('should NOT be visible when controlled and visible is false', () => {
    const controlledProps = {
      isControlled: true,
      visible: false,
      toggleVisibility: jest.fn(),
    };

    renderComponent(controlledProps);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should call toggleVisibility when controlled and popover state changes', async () => {
    const toggleVisibility = jest.fn();
    const controlledProps = {
      isControlled: true,
      visible: false,
      toggleVisibility,
    };

    renderComponent(controlledProps);

    const triggerButton = screen.getByText('Click to add new breakpoint');
    await userEvent.click(triggerButton);

    expect(toggleVisibility).toHaveBeenCalledWith(true);
  });

  test('should render popover content with form elements', async () => {
    renderComponent();

    const triggerButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(triggerButton);

    expect(screen.getByText('Color for breakpoint')).toBeInTheDocument();
    expect(screen.getByText('Min value')).toBeInTheDocument();
    expect(screen.getByText('Max value')).toBeInTheDocument();
  });

  test('should close popover when save is called', async () => {
    renderComponent({ value: mockEmptyBreakpoint });

    const triggerButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(triggerButton);

    const minInput = screen.getAllByRole('spinbutton')[0];
    const maxInput = screen.getAllByRole('spinbutton')[1];

    userEvent.type(minInput, '10');
    userEvent.type(maxInput, '90');

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeEnabled();
    userEvent.click(saveButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should close popover when close button is clicked', async () => {
    renderComponent();

    const triggerButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(triggerButton);

    const closeButton = screen.getByTestId('close-button');
    userEvent.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should handle undefined value prop', async () => {
    renderComponent({ value: undefined });

    const triggerButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(triggerButton);

    expect(screen.queryByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Color for breakpoint')).toBeInTheDocument();
  });

  test('should handle popover open state changes correctly', async () => {
    renderComponent();

    const triggerButton = screen.getByText('Click to add new breakpoint');

    userEvent.click(triggerButton);
    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    userEvent.click(triggerButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should maintain controlled state when toggleVisibility is provided', async () => {
    const toggleVisibility = jest.fn();
    const controlledProps = {
      isControlled: true,
      visible: true,
      toggleVisibility,
    };

    renderComponent(controlledProps);

    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    const closeButton = screen.getByTestId('close-button');
    userEvent.click(closeButton);

    expect(toggleVisibility).toHaveBeenCalledWith(false);
  });

  test('should pass colorBreakpoints to popover content', async () => {
    const colorBreakpoints = [
      { id: 0, color: { r: 255, g: 0, b: 0, a: 1 }, minValue: 0, maxValue: 50 },
      {
        id: 1,
        color: { r: 0, g: 255, b: 0, a: 1 },
        minValue: 50,
        maxValue: 100,
      },
    ];

    renderComponent({ colorBreakpoints });

    const triggerButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(triggerButton);

    expect(screen.queryByRole('dialog')).toBeInTheDocument();
  });

  test('should handle destroyOnHidden prop', async () => {
    renderComponent();

    const triggerButton = screen.getByText('Click to add new breakpoint');
    userEvent.click(triggerButton);

    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    const closeButton = screen.getByTestId('close-button');
    userEvent.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
