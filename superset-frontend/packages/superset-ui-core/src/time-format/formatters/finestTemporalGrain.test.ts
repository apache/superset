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
    new Date('2003-01-01 00:00:00Z').getTime(),
    new Date('2003-02-01 00:00:00Z').getTime(),
  ]);
  expect(monthFormatter(new Date('2003-01-01 00:00:00Z').getTime())).toBe(
    '2003-01-01',
  );
  expect(monthFormatter(new Date('2003-02-01 00:00:00Z').getTime())).toBe(
    '2003-02-01',
  );

  const yearFormatter = finestTemporalGrain([
    new Date('2003-01-01 00:00:00Z').getTime(),
    new Date('2004-01-01 00:00:00Z').getTime(),
  ]);
  expect(yearFormatter(new Date('2003-01-01 00:00:00Z').getTime())).toBe(
    '2003',
  );
  expect(yearFormatter(new Date('2004-01-01 00:00:00Z').getTime())).toBe(
    '2004',
  );

  const milliSecondFormatter = finestTemporalGrain([
    new Date('2003-01-01 00:00:00Z').getTime(),
    new Date('2003-04-05 06:07:08.123Z').getTime(),
  ]);
  expect(milliSecondFormatter(new Date('2003-01-01 00:00:00Z').getTime())).toBe(
    '2003-01-01 00:00:00.000',
  );

  const localTimeFormatter = finestTemporalGrain(
    [
      new Date('2003-01-01 00:00:00Z').getTime(),
      new Date('2003-02-01 00:00:00Z').getTime(),
    ],
    true,
  );
  expect(localTimeFormatter(new Date('2003-01-01 00:00:00Z').getTime())).toBe(
    '2002-12-31 19:00',
  );
});
