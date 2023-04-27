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
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import ActionButtons from './index';

const createProps = () => ({
  onApply: jest.fn(),
  onClearAll: jest.fn(),
  dataMaskSelected: {
    DefaultsID: {
      filterState: {
        value: null,
      },
    },
  },
  dataMaskApplied: {
    DefaultsID: {
      id: 'DefaultsID',
      filterState: {
        value: null,
      },
    },
  },
  isApplyDisabled: false,
});

test('should render the "Apply" button', () => {
  const mockedProps = createProps();
  render(<ActionButtons {...mockedProps} />, { useRedux: true });
  expect(screen.getByText('Apply filters')).toBeInTheDocument();
  expect(screen.getByText('Apply filters').parentElement).toBeEnabled();
});

test('should render the "Clear all" button as disabled', () => {
  const mockedProps = createProps();
  render(<ActionButtons {...mockedProps} />, { useRedux: true });
  const clearBtn = screen.getByText('Clear all');
  expect(clearBtn.parentElement).toBeDisabled();
});

test('should render the "Apply" button as disabled', () => {
  const mockedProps = createProps();
  const applyDisabledProps = {
    ...mockedProps,
    isApplyDisabled: true,
  };
  render(<ActionButtons {...applyDisabledProps} />, { useRedux: true });
  const applyBtn = screen.getByText('Apply filters');
  expect(applyBtn.parentElement).toBeDisabled();
  userEvent.click(applyBtn);
  expect(mockedProps.onApply).not.toHaveBeenCalled();
});

test('should apply', () => {
  const mockedProps = createProps();
  render(<ActionButtons {...mockedProps} />, { useRedux: true });
  const applyBtn = screen.getByText('Apply filters');
  expect(mockedProps.onApply).not.toHaveBeenCalled();
  userEvent.click(applyBtn);
  expect(mockedProps.onApply).toHaveBeenCalled();
});

describe('custom width', () => {
  it('sets its default width with OPEN_FILTER_BAR_WIDTH', () => {
    const mockedProps = createProps();
    render(<ActionButtons {...mockedProps} />, { useRedux: true });
    const container = screen.getByTestId('filterbar-action-buttons');
    expect(container).toHaveStyleRule(
      'width',
      `${OPEN_FILTER_BAR_WIDTH - 1}px`,
    );
  });

  it('sets custom width', () => {
    const mockedProps = createProps();
    const expectedWidth = 423;
    const { getByTestId } = render(
      <ActionButtons {...mockedProps} width={expectedWidth} />,
      {
        useRedux: true,
      },
    );
    const container = getByTestId('filterbar-action-buttons');
    expect(container).toHaveStyleRule('width', `${expectedWidth - 1}px`);
  });
});
