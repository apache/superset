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
import getScrollBarSize from './getScrollBarSize';

test('getScrollBarSize returns a non-negative measurement and cleans up its probe elements', () => {
  const bodyChildCountBefore = document.body.children.length;

  const size = getScrollBarSize(true);

  expect(size).toBeGreaterThanOrEqual(0);
  expect(document.body.children.length).toBe(bodyChildCountBefore);
});

test('getScrollBarSize caches the measurement until forceRefresh is passed', () => {
  const first = getScrollBarSize();
  const appendSpy = jest.spyOn(document.body, 'append');

  const second = getScrollBarSize();
  expect(appendSpy).not.toHaveBeenCalled();
  expect(second).toBe(first);

  getScrollBarSize(true);
  expect(appendSpy).toHaveBeenCalled();

  appendSpy.mockRestore();
});
