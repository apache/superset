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
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';

import { NO_TIME_RANGE } from '@superset-ui/core';
import DateFilterLabel from '..';
import { DateFilterControlProps } from '../types';
import { DATE_FILTER_TEST_KEY } from '../utils';

const mockStore = configureStore([thunk]);

function setup(
  props: Omit<DateFilterControlProps, 'name'>,
  store: any = mockStore({}),
) {
  return (
    <Provider store={store}>
      <DateFilterLabel
        name="time_range"
        onChange={props.onChange}
        overlayStyle={props.overlayStyle}
      />
    </Provider>
  );
}

test('DateFilter with default props', () => {
  render(setup({ onChange: () => {} }));
  // label
  expect(screen.getByText(NO_TIME_RANGE)).toBeInTheDocument();

  // should be popover by default
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(
    screen.getByTestId(DATE_FILTER_TEST_KEY.popoverOverlay),
  ).toBeInTheDocument();
});

test('DateFilter shoule be applied the overlayStyle props', () => {
  render(setup({ onChange: () => {}, overlayStyle: 'Modal' }));
  // should be Modal as overlay
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(
    screen.getByTestId(DATE_FILTER_TEST_KEY.modalOverlay),
  ).toBeInTheDocument();
});

test('DateFilter shoule be applied the global config time_filter from the store', () => {
  render(
    setup(
      { onChange: () => {} },
      mockStore({
        common: { conf: { DEFAULT_TIME_FILTER: 'Last week' } },
      }),
    ),
  );
  // the label should be 'Last week'
  expect(screen.getByText('Last week')).toBeInTheDocument();

  userEvent.click(screen.getByText('Last week'));
  expect(
    screen.getByTestId(DATE_FILTER_TEST_KEY.commonFrame),
  ).toBeInTheDocument();
});
