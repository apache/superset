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
import {
  holdFilterKeyPublish,
  isFilterKeyPublishHeld,
  isProtectedFilterKey,
  releaseFilterKeyPublish,
  resetFilterKeyHold,
  subscribeFilterKeyPublishRelease,
} from './sharedFilterStateHold';

afterEach(() => {
  resetFilterKeyHold();
});

test('holds until released and keeps protecting the original key', () => {
  holdFilterKeyPublish('original');
  expect(isFilterKeyPublishHeld()).toBe(true);
  expect(isProtectedFilterKey('original')).toBe(true);
  expect(isProtectedFilterKey('other')).toBe(false);

  releaseFilterKeyPublish();
  expect(isFilterKeyPublishHeld()).toBe(false);
  // Overlapping publishes may still see the original key in the URL; it must
  // never be updated, only replaced by a new key.
  expect(isProtectedFilterKey('original')).toBe(true);
});

test('reset clears both the hold and the protection', () => {
  holdFilterKeyPublish('original');
  resetFilterKeyHold();
  expect(isFilterKeyPublishHeld()).toBe(false);
  expect(isProtectedFilterKey('original')).toBe(false);
});

test('nothing is protected without a hold', () => {
  expect(isProtectedFilterKey('any')).toBe(false);
  expect(isProtectedFilterKey(null)).toBe(false);
  expect(isProtectedFilterKey(undefined)).toBe(false);
});

test('notifies subscribers only when an active hold is released', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeFilterKeyPublishRelease(listener);

  releaseFilterKeyPublish();
  expect(listener).not.toHaveBeenCalled();

  holdFilterKeyPublish('k');
  releaseFilterKeyPublish();
  expect(listener).toHaveBeenCalledTimes(1);

  unsubscribe();
  holdFilterKeyPublish('k');
  releaseFilterKeyPublish();
  expect(listener).toHaveBeenCalledTimes(1);
});
