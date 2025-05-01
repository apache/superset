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
import { NumberFormats } from '@superset-ui/core';
import { getPercentFormatter } from '../../src/utils/formatters';

describe('getPercentFormatter', () => {
  const value = 0.6;
  it('should format as percent if no format is specified', () => {
    expect(getPercentFormatter().format(value)).toEqual('60%');
  });
  it('should format as percent if SMART_NUMBER is specified', () => {
    expect(
      getPercentFormatter(NumberFormats.SMART_NUMBER).format(value),
    ).toEqual('60%');
  });
  it('should format using a provided format', () => {
    expect(
      getPercentFormatter(NumberFormats.PERCENT_2_POINT).format(value),
    ).toEqual('60.00%');
  });
});
