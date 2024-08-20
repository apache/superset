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
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect'; // For advanced DOM assertions
import { CurrentCalendarFrame } from '../components/CurrentCalendarFrame';
import { CurrentWeek } from '../types';

const mockOnChange = jest.fn();

test('calls onChange(CurrentWeek) when value is invalid', () => {
  render(<CurrentCalendarFrame onChange={mockOnChange} value="InvalidValue" />);
  expect(mockOnChange).toHaveBeenCalledWith(CurrentWeek);
});

test('returns null if value is not a valid CurrentRangeType', () => {
  const { container } = render(
    <CurrentCalendarFrame onChange={mockOnChange} value="InvalidValue" />,
  );
  expect(container.childNodes.length).toBe(0);
});
