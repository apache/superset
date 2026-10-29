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
import { render, screen } from 'spec/helpers/testing-library';
import { DateRangeFrame } from '../components/DateRangeFrame';

test('shows the stored whole-day range as calendar dates, with the end date included', () => {
  render(
    <DateRangeFrame value="2021-03-16 : 2021-03-18" onChange={jest.fn()} />,
  );
  expect(
    screen.getByText('Configure Time Range: Calendar...'),
  ).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Start date')).toHaveValue('2021-03-16');
  expect(screen.getByPlaceholderText('End date')).toHaveValue('2021-03-17');
});
