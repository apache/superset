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

import { customTimeRangeDecode } from '@superset-ui/core';

describe('customTimeRangeDecode', () => {
  it('1) specific : specific', () => {
    expect(
      customTimeRangeDecode('2021-01-20T00:00:00 : 2021-01-27T00:00:00'),
    ).toEqual({
      customRange: {
        sinceDatetime: '2021-01-20T00:00:00',
        sinceMode: 'specific',
        sinceGrain: 'day',
        sinceGrainValue: -7,
        untilDatetime: '2021-01-27T00:00:00',
        untilMode: 'specific',
        untilGrain: 'day',
        untilGrainValue: 7,
        anchorMode: 'now',
        anchorValue: 'now',
      },
      matchedFlag: true,
    });
  });

  it('2) specific : relative', () => {
    expect(
      customTimeRangeDecode(
        '2021-01-20T00:00:00 : DATEADD(DATETIME("2021-01-20T00:00:00"), 7, day)',
      ),
    ).toEqual({
      customRange: {
        sinceDatetime: '2021-01-20T00:00:00',
        sinceMode: 'specific',
        sinceGrain: 'day',
        sinceGrainValue: -7,
        untilDatetime: '2021-01-20T00:00:00',
        untilMode: 'relative',
        untilGrain: 'day',
        untilGrainValue: 7,
        anchorMode: 'now',
        anchorValue: 'now',
      },
      matchedFlag: true,
    });
  });

  it('3) relative : specific', () => {
    expect(
      customTimeRangeDecode(
        'DATEADD(DATETIME("2021-01-27T00:00:00"), -7, day) : 2021-01-27T00:00:00',
      ),
    ).toEqual({
      customRange: {
        sinceDatetime: '2021-01-27T00:00:00',
        sinceMode: 'relative',
        sinceGrain: 'day',
        sinceGrainValue: -7,
        untilDatetime: '2021-01-27T00:00:00',
        untilMode: 'specific',
        untilGrain: 'day',
        untilGrainValue: 7,
        anchorMode: 'now',
        anchorValue: 'now',
      },
      matchedFlag: true,
    });
  });

  it('4) relative : relative (now)', () => {
    expect(
      customTimeRangeDecode(
        'DATEADD(DATETIME("now"), -7, day) : DATEADD(DATETIME("now"), 7, day)',
      ),
    ).toEqual({
      customRange: {
        sinceDatetime: 'now',
        sinceMode: 'relative',
        sinceGrain: 'day',
        sinceGrainValue: -7,
        untilDatetime: 'now',
        untilMode: 'relative',
        untilGrain: 'day',
        untilGrainValue: 7,
        anchorMode: 'now',
        anchorValue: 'now',
      },
      matchedFlag: true,
    });
  });

  it('5) relative : relative (date/time)', () => {
    expect(
      customTimeRangeDecode(
        'DATEADD(DATETIME("2021-01-27T00:00:00"), -7, day) : DATEADD(DATETIME("2021-01-27T00:00:00"), 7, day)',
      ),
    ).toEqual({
      customRange: {
        sinceDatetime: '2021-01-27T00:00:00',
        sinceMode: 'relative',
        sinceGrain: 'day',
        sinceGrainValue: -7,
        untilDatetime: '2021-01-27T00:00:00',
        untilMode: 'relative',
        untilGrain: 'day',
        untilGrainValue: 7,
        anchorMode: 'specific',
        anchorValue: '2021-01-27T00:00:00',
      },
      matchedFlag: true,
    });
  });
});
