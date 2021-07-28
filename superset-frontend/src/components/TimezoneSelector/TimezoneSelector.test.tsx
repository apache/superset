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
import moment from 'moment-timezone';
import { render } from 'spec/helpers/testing-library';
import TimezoneSelector from './index';

describe('TimezoneSelector', () => {
  let timezone: string;
  const onTimezoneChange = jest.fn(zone => {
    timezone = zone;
  });
  it('renders a TimezoneSelector with a default if undefined', () => {
    jest.spyOn(moment.tz, 'guess').mockReturnValue('America/New_York');
    render(
      <TimezoneSelector
        onTimezoneChange={onTimezoneChange}
        timezone={timezone}
      />,
    );
    expect(onTimezoneChange).toHaveBeenCalledWith('America/Nassau');
  });
  it('renders a TimezoneSelector with the closest value if passed in', async () => {
    render(
      <TimezoneSelector
        onTimezoneChange={onTimezoneChange}
        timezone="America/Los_Angeles"
      />,
    );
    expect(onTimezoneChange).toHaveBeenLastCalledWith('America/Vancouver');
  });
});
