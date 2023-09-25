/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0,
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import finestTemporalGrain from './finestTemporalGrain';

test('finestTemporalGrain', () => {
  const monthFormatter = finestTemporalGrain([
    1041379200000, // 2003-01-01 00:00:00Z
    1044057600000, // 2003-02-01 00:00:00Z
  ]);
  expect(monthFormatter(1041379200000)).toBe('2003-01-01');
  expect(monthFormatter(1044057600000)).toBe('2003-02-01');

  const yearFormatter = finestTemporalGrain([
    1041379200000, // 2003-01-01 00:00:00Z
    1072915200000, // 2004-01-01 00:00:00Z
  ]);
  expect(yearFormatter(1041379200000)).toBe('2003');
  expect(yearFormatter(1072915200000)).toBe('2004');
});
