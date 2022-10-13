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
import { isXAxisSet } from '@superset-ui/core';

describe('GENERIC_CHART_AXES is enabled', () => {
  let windowSpy: any;

  beforeAll(() => {
    // @ts-ignore
    windowSpy = jest.spyOn(window, 'window', 'get').mockImplementation(() => ({
      featureFlags: {
        GENERIC_CHART_AXES: true,
      },
    }));
  });

  afterAll(() => {
    windowSpy.mockRestore();
  });

  it('isEnabledAxies when FF is disabled', () => {
    expect(
      isXAxisSet({ datasource: '123', viz_type: 'table' }),
    ).not.toBeTruthy();
    expect(
      isXAxisSet({ datasource: '123', viz_type: 'table', x_axis: 'axis' }),
    ).toBeTruthy();
  });
});

describe('GENERIC_CHART_AXES is disabled', () => {
  let windowSpy: any;

  beforeAll(() => {
    // @ts-ignore
    windowSpy = jest.spyOn(window, 'window', 'get').mockImplementation(() => ({
      featureFlags: {
        GENERIC_CHART_AXES: false,
      },
    }));
  });

  afterAll(() => {
    windowSpy.mockRestore();
  });

  it('isEnabledAxies when FF is disabled', () => {
    expect(
      isXAxisSet({ datasource: '123', viz_type: 'table' }),
    ).not.toBeTruthy();
    expect(
      isXAxisSet({ datasource: '123', viz_type: 'table', x_axis: 'axis' }),
    ).toBeTruthy();
  });
});
