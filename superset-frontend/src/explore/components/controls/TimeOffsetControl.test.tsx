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
import configureStore from 'redux-mock-store';
import { render, screen } from 'spec/helpers/testing-library';
import { INVALID_DATE } from '@superset-ui/chart-controls';
import { extendedDayjs } from 'src/utils/dates';
import TimeOffsetControls, {
  TimeOffsetControlsProps,
} from './TimeOffsetControl';

const mockStore = configureStore([]);

const defaultProps: TimeOffsetControlsProps = {
  onChange: jest.fn(),
};

describe('TimeOffsetControls', () => {
  const setup = (initialState = {}) => {
    const store = mockStore({
      explore: {
        form_data: {
          adhoc_filters: [
            {
              operator: 'TEMPORAL_RANGE',
              subject: 'date',
              comparator: '2023-01-01 : 2023-12-31',
            },
          ],
          start_date_offset: '2023-01-01',
          ...initialState,
        },
      },
    });

    const props = { ...defaultProps };

    render(<TimeOffsetControls {...props} />, { store });

    return { store, props };
  };

  it('TimeOffsetControl renders DatePicker when startDate is set', () => {
    setup();
    const datePickerInput = screen.getByRole('textbox');
    expect(datePickerInput).toBeInTheDocument();
    expect(datePickerInput).toHaveValue('2023-01-01');
  });

  // Our Time comparison control depends on this string for supporting date deletion on date picker
  // That's why this test is linked to the TimeOffsetControl component
  it('Dayjs should return "Invalid date" when parsing an invalid date string', () => {
    const invalidDate = extendedDayjs('not-a-date');
    expect(invalidDate.format()).toBe(INVALID_DATE);
  });
});
