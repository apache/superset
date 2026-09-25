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
import { KeyboardEvent } from 'react';
import { handleKeyboardActivation } from './handleKeyboardActivation';

const makeEvent = (key: string, repeat = false) => {
  const preventDefault = jest.fn();
  return {
    event: { key, repeat, preventDefault } as unknown as KeyboardEvent,
    preventDefault,
  };
};

test('invokes the callback and prevents default on Enter', () => {
  const callback = jest.fn();
  const { event, preventDefault } = makeEvent('Enter');
  handleKeyboardActivation(callback)(event);
  expect(callback).toHaveBeenCalledWith(event);
  expect(preventDefault).toHaveBeenCalled();
});

test('invokes the callback and prevents default on Space', () => {
  const callback = jest.fn();
  const { event, preventDefault } = makeEvent(' ');
  handleKeyboardActivation(callback)(event);
  expect(callback).toHaveBeenCalledWith(event);
  expect(preventDefault).toHaveBeenCalled();
});

test('ignores other keys', () => {
  const callback = jest.fn();
  const { event, preventDefault } = makeEvent('a');
  handleKeyboardActivation(callback)(event);
  expect(callback).not.toHaveBeenCalled();
  expect(preventDefault).not.toHaveBeenCalled();
});

test('ignores auto-repeat keydown events fired while a key is held', () => {
  const callback = jest.fn();
  const { event, preventDefault } = makeEvent('Enter', true);
  handleKeyboardActivation(callback)(event);
  expect(callback).not.toHaveBeenCalled();
  // preventDefault still fires on the repeat event itself, matching the
  // non-repeat Enter case above.
  expect(preventDefault).toHaveBeenCalled();
});
