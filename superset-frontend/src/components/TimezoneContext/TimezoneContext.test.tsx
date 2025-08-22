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

import { render, screen } from '@testing-library/react';
import { TimezoneProvider, useTimezone } from './index';

// Mock the URL parameter utility
jest.mock('src/utils/urlUtils', () => ({
  getUrlParam: jest.fn(() => null),
}));

function TestComponent() {
  const { timezone, formatDate, formatDateTime } = useTimezone();
  const testDate = new Date('2023-12-25T12:00:00Z');

  return (
    <div>
      <div data-test="timezone">{timezone}</div>
      <div data-test="formatted-date">{formatDate(testDate)}</div>
      <div data-test="formatted-datetime">{formatDateTime(testDate)}</div>
    </div>
  );
}

describe('TimezoneContext', () => {
  it('should provide default timezone when no URL parameter is set', () => {
    render(
      <TimezoneProvider>
        <TestComponent />
      </TimezoneProvider>
    );

    const timezoneElement = screen.getByTestId('timezone');
    expect(timezoneElement).toBeTruthy();
    expect(timezoneElement.textContent).toBe('UTC');
  });

  it('should format dates correctly', () => {
    render(
      <TimezoneProvider>
        <TestComponent />
      </TimezoneProvider>
    );

    const formattedDate = screen.getByTestId('formatted-date');
    const formattedDateTime = screen.getByTestId('formatted-datetime');

    expect(formattedDate).toBeTruthy();
    expect(formattedDateTime).toBeTruthy();

    // Check that the formatted values contain expected patterns
    expect(formattedDate.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formattedDateTime.textContent).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('should throw error when useTimezone is used outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTimezone must be used within a TimezoneProvider');

    spy.mockRestore();
  });
});