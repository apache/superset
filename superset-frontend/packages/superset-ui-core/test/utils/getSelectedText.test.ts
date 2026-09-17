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
import { getSelectedText } from '@superset-ui/core';

test('Returns null if Selection object is null', () => {
  jest.spyOn(window, 'getSelection').mockImplementationOnce(() => null);
  expect(getSelectedText()).toEqual(undefined);
  jest.restoreAllMocks();
});

test('Returns selection text if Selection object is not null', () => {
  jest
    .spyOn(window, 'getSelection')
    // @ts-ignore
    .mockImplementationOnce(() => ({ toString: () => 'test string' }));
  expect(getSelectedText()).toEqual('test string');
  jest.restoreAllMocks();
});
