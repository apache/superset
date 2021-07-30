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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import Header from './index';

const createProps = () => ({
  toggleFiltersBar: jest.fn(),
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

test('should render', () => {
  const mockedProps = createProps();
  const { container } = render(<Header {...mockedProps} />, { useRedux: true });
  expect(container).toBeInTheDocument();
});

test('should render the "Filters" heading', () => {
  const mockedProps = createProps();
  render(<Header {...mockedProps} />, { useRedux: true });
  expect(screen.getByText('Filters')).toBeInTheDocument();
});

test('should render the "Clear all" option', () => {
  const mockedProps = createProps();
  render(<Header {...mockedProps} />, { useRedux: true });
  expect(screen.getByText('Clear all')).toBeInTheDocument();
});

test('should render the "Apply" button', () => {
  const mockedProps = createProps();
  render(<Header {...mockedProps} />, { useRedux: true });
  expect(screen.getByText('Apply')).toBeInTheDocument();
  expect(screen.getByText('Apply').parentElement).toBeEnabled();
});

test('should render the "Clear all" button as disabled', () => {
  const mockedProps = createProps();
  render(<Header {...mockedProps} />, { useRedux: true });
  const clearBtn = screen.getByText('Clear all');
  expect(clearBtn.parentElement).toBeDisabled();
});

test('should render the "Apply" button as disabled', () => {
  const mockedProps = createProps();
  const applyDisabledProps = {
    ...mockedProps,
    isApplyDisabled: true,
  };
  render(<Header {...applyDisabledProps} />, { useRedux: true });
  const applyBtn = screen.getByText('Apply');
  expect(applyBtn.parentElement).toBeDisabled();
  userEvent.click(applyBtn);
  expect(mockedProps.onApply).not.toHaveBeenCalled();
});

test('should apply', () => {
  const mockedProps = createProps();
  render(<Header {...mockedProps} />, { useRedux: true });
  const applyBtn = screen.getByText('Apply');
  expect(mockedProps.onApply).not.toHaveBeenCalled();
  userEvent.click(applyBtn);
  expect(mockedProps.onApply).toHaveBeenCalled();
});

test('should render the expand button', () => {
  const mockedProps = createProps();
  render(<Header {...mockedProps} />, { useRedux: true });
  expect(screen.getByRole('button', { name: 'expand' })).toBeInTheDocument();
});

test('should toggle', () => {
  const mockedProps = createProps();
  render(<Header {...mockedProps} />, { useRedux: true });
  const expandBtn = screen.getByRole('button', { name: 'expand' });
  expect(mockedProps.toggleFiltersBar).not.toHaveBeenCalled();
  userEvent.click(expandBtn);
  expect(mockedProps.toggleFiltersBar).toHaveBeenCalled();
});
