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

import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@superset-ui/core';
import { theme } from 'src/preamble';
import CostWarningModal from './index';

const mockProps = {
  visible: true,
  onHide: jest.fn(),
  onProceed: jest.fn(),
  warningMessage: 'This query will scan 10 GB of data, which exceeds the threshold of 5 GB.',
  thresholdInfo: {
    bytes_threshold: 5 * 1024 ** 3, // 5 GB
    estimated_bytes: 10 * 1024 ** 3, // 10 GB
  },
};

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('CostWarningModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with warning message', () => {
    renderWithTheme(<CostWarningModal {...mockProps} />);

    expect(screen.getByText('Query Cost Warning')).toBeInTheDocument();
    expect(screen.getByText(mockProps.warningMessage)).toBeInTheDocument();
  });

  it('shows threshold details when provided', () => {
    renderWithTheme(<CostWarningModal {...mockProps} />);

    expect(screen.getByText('Threshold Details:')).toBeInTheDocument();
    expect(screen.getByText('Data to scan:')).toBeInTheDocument();
    expect(screen.getByText('10.0 GB')).toBeInTheDocument();
    expect(screen.getByText('5.0 GB')).toBeInTheDocument();
  });

  it('disables proceed button until checkbox is checked', () => {
    renderWithTheme(<CostWarningModal {...mockProps} />);

    const proceedButton = screen.getByText('Run Query Anyway');
    const checkbox = screen.getByRole('checkbox');

    expect(proceedButton).toBeDisabled();

    fireEvent.click(checkbox);
    expect(proceedButton).not.toBeDisabled();
  });

  it('calls onProceed when proceed button is clicked with checkbox checked', () => {
    renderWithTheme(<CostWarningModal {...mockProps} />);

    const checkbox = screen.getByRole('checkbox');
    const proceedButton = screen.getByText('Run Query Anyway');

    fireEvent.click(checkbox);
    fireEvent.click(proceedButton);

    expect(mockProps.onProceed).toHaveBeenCalledTimes(1);
  });

  it('calls onHide when cancel button is clicked', () => {
    renderWithTheme(<CostWarningModal {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onHide).toHaveBeenCalledTimes(1);
  });

  it('renders without threshold details when not provided', () => {
    const propsWithoutThreshold = {
      ...mockProps,
      thresholdInfo: undefined,
    };

    renderWithTheme(<CostWarningModal {...propsWithoutThreshold} />);

    expect(screen.queryByText('Threshold Details:')).not.toBeInTheDocument();
  });

  it('shows default message when warningMessage is null', () => {
    const propsWithNoMessage = {
      ...mockProps,
      warningMessage: null,
    };

    renderWithTheme(<CostWarningModal {...propsWithNoMessage} />);

    expect(screen.getByText('This query may be expensive to run.')).toBeInTheDocument();
  });

  it('handles cost threshold details', () => {
    const propsWithCostThreshold = {
      ...mockProps,
      thresholdInfo: {
        cost_threshold: 100,
        estimated_cost: 250,
      },
    };

    renderWithTheme(<CostWarningModal {...propsWithCostThreshold} />);

    expect(screen.getByText('Estimated cost:')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('Cost threshold:')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
