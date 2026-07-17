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
import { getTimeFormatter } from '@superset-ui/core';
import { getTimeOrNumberFormatter } from '../src/utils';

test('a number format renders a formatted number, not the literal name', () => {
  // Time Pivot's x-axis defaults x_axis_format to SMART_NUMBER; NVD3Vis now
  // routes it through getTimeOrNumberFormatter (number-aware) rather than
  // getTimeFormatter, which would print the literal "SMART_NUMBER" every tick.
  expect(getTimeOrNumberFormatter('SMART_NUMBER')(1950000)).toBe('1.95M');
  expect(getTimeFormatter('SMART_NUMBER')(new Date(Date.UTC(2024, 0, 1)))).toBe(
    'SMART_NUMBER',
  );
});
