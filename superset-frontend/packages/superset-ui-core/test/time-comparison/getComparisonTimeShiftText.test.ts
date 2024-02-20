/*
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
  getComparisonTimeShiftText,
  ComparisonTimeRangeType,
} from '@superset-ui/core';

describe('getComparisonTimeShiftText', () => {
  it('Handles ComparisonTimeRangeType.Year', () => {
    const result = getComparisonTimeShiftText(ComparisonTimeRangeType.Year);

    expect(result).toEqual('1 year');
  });

  it('Handles ComparisonTimeRangeType.Month', () => {
    const result = getComparisonTimeShiftText(ComparisonTimeRangeType.Month);

    expect(result).toEqual('1 month');
  });

  it('Handles ComparisonTimeRangeType.Week', () => {
    const result = getComparisonTimeShiftText(ComparisonTimeRangeType.Week);

    expect(result).toEqual('1 week');
  });

  it('Handles ComparisonTimeRangeType.InheritedRange', () => {
    const result = getComparisonTimeShiftText(
      ComparisonTimeRangeType.InheritedRange,
    );

    expect(result).toEqual('inherited');
  });

  it('Handles ComparisonTimeRangeType.Custom', () => {
    const result = getComparisonTimeShiftText(ComparisonTimeRangeType.Custom);
    expect(result).toBeUndefined();
  });

  it('Handles Unknown values', () => {
    const result = getComparisonTimeShiftText('Non existing Text');
    expect(result).toBeUndefined();
  });
});
