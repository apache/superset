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

import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { CalendarFrame } from '../components/CalendarFrame';
import { PreviousCalendarWeek, PreviousCalendarQuarter } from '../types';
import { CALENDAR_RANGE_OPTIONS } from '../utils/constants';

describe('CalendarFrame', () => {
  it('calls onChange with PreviousCalendarWeek if value is not in CALENDAR_RANGE_SET', () => {
    const mockOnChange = jest.fn();
    render(<CalendarFrame onChange={mockOnChange} value="invalid-value" />);

    expect(mockOnChange).toHaveBeenCalledWith(PreviousCalendarWeek);
  });

  it('renders null if value is not in CALENDAR_RANGE_SET', () => {
    render(<CalendarFrame onChange={jest.fn()} value="invalid-value" />);
    expect(
      screen.queryByText('Configure Time Range: Previous...'),
    ).not.toBeInTheDocument();
  });

  it('renders the correct number of radio options', () => {
    render(<CalendarFrame onChange={jest.fn()} value={PreviousCalendarWeek} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(CALENDAR_RANGE_OPTIONS.length);
    CALENDAR_RANGE_OPTIONS.forEach(option => {
      expect(screen.getByText(option.label as string)).toBeInTheDocument();
    });
  });

  it('calls onChange with the correct value when a radio button is selected', () => {
    const mockOnChange = jest.fn();
    render(
      <CalendarFrame
        onChange={mockOnChange}
        value={CALENDAR_RANGE_OPTIONS[0].value}
      />,
    );

    const secondOption = CALENDAR_RANGE_OPTIONS[1];
    const radio = screen.getByLabelText(secondOption.label as string);
    fireEvent.click(radio);

    expect(mockOnChange).toHaveBeenCalledWith(secondOption.value);
  });

  it('renders the section title correctly', () => {
    render(
      <CalendarFrame
        onChange={jest.fn()}
        value={CALENDAR_RANGE_OPTIONS[0].value}
      />,
    );
    expect(
      screen.getByText('Configure Time Range: Previous...'),
    ).toBeInTheDocument();
  });

  it('ensures the third option is PreviousCalendarQuarter', () => {
    render(
      <CalendarFrame
        onChange={jest.fn()}
        value={CALENDAR_RANGE_OPTIONS[0].value}
      />,
    );

    const thirdOption = CALENDAR_RANGE_OPTIONS[2];
    expect(thirdOption.value).toBe(PreviousCalendarQuarter);

    expect(
      screen.getByLabelText(thirdOption.label as string),
    ).toBeInTheDocument();
  });
});
