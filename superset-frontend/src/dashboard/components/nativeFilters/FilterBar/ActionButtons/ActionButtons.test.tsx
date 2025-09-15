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
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import ActionButtons from './index';

const createProps = () => ({
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
});

test('should render the "Reset All" button as disabled', () => {
  const mockedProps = createProps();
  render(<ActionButtons {...mockedProps} />, { useRedux: true });
  const clearBtn = screen.getByText('Reset All');
  expect(clearBtn.parentElement).toBeDisabled();
});

test('should call onClearAll when clear all button is clicked', () => {
  const mockedProps = {
    ...createProps(),
    dataMaskSelected: {
      DefaultsID: {
        filterState: {
          value: 'some_value', // Make clear button enabled
        },
      },
    },
    dataMaskApplied: {
      DefaultsID: {
        id: 'DefaultsID',
        filterState: {
          value: 'some_value', // Make clear button enabled
        },
      },
    },
  };
  render(<ActionButtons {...mockedProps} />, { useRedux: true });
  const clearBtn = screen.getByText('Reset All');
  expect(clearBtn.parentElement).toBeEnabled();
  expect(mockedProps.onClearAll).not.toHaveBeenCalled();
  userEvent.click(clearBtn);
  expect(mockedProps.onClearAll).toHaveBeenCalled();
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
