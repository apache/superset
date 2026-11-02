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
  consumeNeedsNewKey,
  holdFilterKeyPublish,
  isFilterKeyPublishHeld,
  releaseFilterKeyPublish,
  subscribeFilterKeyPublishRelease,
} from './sharedFilterStateHold';

afterEach(() => {
  releaseFilterKeyPublish();
  consumeNeedsNewKey();
});

test('holds until released, then asks for a new key exactly once', () => {
  holdFilterKeyPublish();
  expect(isFilterKeyPublishHeld()).toBe(true);
  expect(consumeNeedsNewKey()).toBe(false);

  releaseFilterKeyPublish();
  expect(isFilterKeyPublishHeld()).toBe(false);
  expect(consumeNeedsNewKey()).toBe(true);
  expect(consumeNeedsNewKey()).toBe(false);
});

test('releasing without a hold does not request a new key', () => {
  releaseFilterKeyPublish();
  expect(consumeNeedsNewKey()).toBe(false);
});

test('notifies subscribers only when an active hold is released', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeFilterKeyPublishRelease(listener);

  releaseFilterKeyPublish();
  expect(listener).not.toHaveBeenCalled();

  holdFilterKeyPublish();
  releaseFilterKeyPublish();
  expect(listener).toHaveBeenCalledTimes(1);

  unsubscribe();
  holdFilterKeyPublish();
  releaseFilterKeyPublish();
  expect(listener).toHaveBeenCalledTimes(1);
});
