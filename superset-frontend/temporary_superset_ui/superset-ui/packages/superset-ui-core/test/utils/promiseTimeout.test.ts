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

import { promiseTimeout } from '@superset-ui/core/src';

describe('promiseTimeout(func, delay)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves after delay', async () => {
    const promise = promiseTimeout(() => 'abcd', 10);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toEqual('abcd');
    expect(result).toHaveLength(4);
  });

  it('uses the timer', async () => {
    const promise = Promise.race([
      promiseTimeout(() => 'abc', 10),
      promiseTimeout(() => 'def', 20),
    ]);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toEqual('abc');
  });
});
