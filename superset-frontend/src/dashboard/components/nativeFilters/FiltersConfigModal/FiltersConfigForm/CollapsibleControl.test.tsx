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
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import { CollapsibleControl } from './CollapsibleControl';

// Mock the InfoTooltipWithTrigger component
jest.mock('@superset-ui/chart-controls', () => ({
  InfoTooltipWithTrigger: ({ tooltip }: { tooltip: string }) => (
    <span data-test="info-tooltip" data-tooltip={tooltip} />
  ),
}));

const defaultProps = {
  title: 'Test Control',
  children: <div data-test="child-content">Child Content</div>,
};

const renderCollapsibleControl = (props = {}) => 
  render(
    <ThemeProvider theme={supersetTheme}>
      <CollapsibleControl {...defaultProps} {...props} />
    </ThemeProvider>
  );

describe('CollapsibleControl', () => {
  it('renders title correctly', () => {
    const { getByText } = renderCollapsibleControl();
    expect(getByText('Test Control')).toBeInTheDocument();
  });

  it('renders tooltip when provided', () => {
    const tooltipText = 'Test tooltip';
    const { container } = renderCollapsibleControl({ tooltip: tooltipText });
    const tooltip = container.querySelector('[data-test="info-tooltip"]');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute('data-tooltip', tooltipText);
  });

  it('starts collapsed when initialValue is false', () => {
    const { container } = renderCollapsibleControl({ initialValue: false });
    const childContent = container.querySelector('[data-test="child-content"]');
    expect(childContent).not.toBeInTheDocument();
  });

  it('starts expanded when initialValue is true', () => {
    const { container } = renderCollapsibleControl({ initialValue: true });
    const childContent = container.querySelector('[data-test="child-content"]');
    expect(childContent).toBeInTheDocument();
  });

  it('toggles content when clicked', () => {
    const { container, getByText } = renderCollapsibleControl();
    const checkbox = getByText('Test Control').closest('label');

    // Initially collapsed
    expect(container.querySelector('[data-test="child-content"]')).not.toBeInTheDocument();

    // Expand
    if (checkbox) {
      fireEvent.click(checkbox);
      expect(container.querySelector('[data-test="child-content"]')).toBeInTheDocument();

      // Collapse
      fireEvent.click(checkbox);
      expect(container.querySelector('[data-test="child-content"]')).not.toBeInTheDocument();
    }
  });

  it('calls onChange handler when toggled', () => {
    const onChangeMock = jest.fn();
    const { getByText } = renderCollapsibleControl({ onChange: onChangeMock });
    const checkbox = getByText('Test Control').closest('label');

    if (checkbox) {
      fireEvent.click(checkbox);
      expect(onChangeMock).toHaveBeenCalledWith(true);

      fireEvent.click(checkbox);
      expect(onChangeMock).toHaveBeenCalledWith(false);
    }
  });

  it('respects disabled prop', () => {
    const onChangeMock = jest.fn();
    const { container } = renderCollapsibleControl({ 
      disabled: true, 
      onChange: onChangeMock 
    });

    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeDisabled();

    if (checkbox) {
      fireEvent.click(checkbox);
      expect(onChangeMock).not.toHaveBeenCalled();
    }
  });

  it('updates when controlled checked prop changes', () => {
    const { rerender, queryByTestId } = renderCollapsibleControl({ checked: false });
    expect(queryByTestId('child-content')).not.toBeInTheDocument();

    rerender(
      <ThemeProvider theme={supersetTheme}>
        <CollapsibleControl {...defaultProps} checked={true} />
      </ThemeProvider>
    );
    expect(queryByTestId('child-content')).toBeInTheDocument();
  });

  it('maintains local state when in uncontrolled mode', () => {
    const { getByText, queryByTestId } = renderCollapsibleControl({ initialValue: false });
    const checkbox = getByText('Test Control').closest('label');

    expect(queryByTestId('child-content')).not.toBeInTheDocument();

    if (checkbox) {
      fireEvent.click(checkbox);
      expect(queryByTestId('child-content')).toBeInTheDocument();

      fireEvent.click(checkbox);
      expect(queryByTestId('child-content')).not.toBeInTheDocument();
    }
  });
});