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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CollapsibleControl } from './CollapsibleControl';

const defaultProps = {
  title: 'Test Control',
  children: <div data-test="child-content">Child Content</div>,
};

const renderCollapsibleControl = (props = {}) =>
  render(<CollapsibleControl {...defaultProps} {...props} />);

describe('CollapsibleControl', () => {
  it('renders title correctly', () => {
    const { getByRole } = renderCollapsibleControl();
    expect(
      getByRole('checkbox', { name: /test control/i }),
    ).toBeInTheDocument();
  });

  it('renders tooltip when provided', () => {
    const tooltipText = 'Test tooltip';
    renderCollapsibleControl({ tooltip: tooltipText });

    const tooltip = screen.getByRole('button', { name: 'Show info tooltip' });
    expect(tooltip).toBeInTheDocument();
  });

  it('starts collapsed when initialValue is false', () => {
    renderCollapsibleControl({ initialValue: false });
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('starts expanded when initialValue is true', () => {
    renderCollapsibleControl({ initialValue: true });

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('toggles content when clicked', async () => {
    renderCollapsibleControl();
    const checkbox = screen.getByRole('checkbox', { name: /Test Control/i });

    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

    await userEvent.click(checkbox);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();

    await userEvent.click(checkbox);
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('calls onChange handler when toggled', async () => {
    const onChangeMock = jest.fn();
    renderCollapsibleControl({ onChange: onChangeMock });
    const checkbox = screen.getByRole('checkbox', { name: /Test Control/i });

    await userEvent.click(checkbox);
    expect(onChangeMock).toHaveBeenCalledWith(true);

    await userEvent.click(checkbox);
    expect(onChangeMock).toHaveBeenCalledWith(false);
  });

  it('respects disabled prop', async () => {
    const onChangeMock = jest.fn();
    renderCollapsibleControl({
      disabled: true,
      onChange: onChangeMock,
    });

    const checkbox = screen.getByRole('checkbox', { name: /Test Control/i });
    expect(checkbox).toBeDisabled();

    await userEvent.click(checkbox);
    expect(onChangeMock).not.toHaveBeenCalled();
  });

  it('updates when controlled checked prop changes', () => {
    const { rerender } = renderCollapsibleControl({ checked: false });
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

    rerender(<CollapsibleControl {...defaultProps} checked />);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('maintains local state when in uncontrolled mode', async () => {
    renderCollapsibleControl({ initialValue: false });
    const checkbox = screen.getByRole('checkbox', { name: /Test Control/i });

    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

    await userEvent.click(checkbox);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();

    await userEvent.click(checkbox);
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });
});
