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

import {
  CALENDAR_TOOLTIP_CLASS,
  removeCalendarTooltips,
} from '../src/tooltip';

test('removeCalendarTooltips removes only calendar d3-tip nodes', () => {
  const calendarTooltip = document.createElement('div');
  calendarTooltip.className = `d3-tip ${CALENDAR_TOOLTIP_CLASS}`;
  document.body.appendChild(calendarTooltip);

  const otherTooltip = document.createElement('div');
  otherTooltip.className = 'd3-tip tooltip-other-chart';
  document.body.appendChild(otherTooltip);

  removeCalendarTooltips();

  expect(document.querySelector(`.${CALENDAR_TOOLTIP_CLASS}`)).toBeNull();
  expect(document.querySelector('.tooltip-other-chart')).toBe(otherTooltip);

  otherTooltip.remove();
});
