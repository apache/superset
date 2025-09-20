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

import DebouncedMessageQueue from './DebouncedMessageQueue';

describe('DebouncedMessageQueue', () => {
  it('should create a queue with default options', () => {
    const queue = new DebouncedMessageQueue();
    expect(queue).toBeDefined();
    expect(queue.trigger).toBeInstanceOf(Function);
  });

  it('should accept custom configuration options', () => {
    const mockCallback = jest.fn();
    const queue = new DebouncedMessageQueue({
      callback: mockCallback,
      sizeThreshold: 500,
      delayThreshold: 2000,
    });
    expect(queue).toBeDefined();
  });

  it('should append items to the queue', () => {
    const mockCallback = jest.fn();
    const queue = new DebouncedMessageQueue({ callback: mockCallback });

    const testEvent = { id: 1, message: 'test' };
    queue.append(testEvent);

    // Verify the append method doesn't throw
    expect(() => queue.append(testEvent)).not.toThrow();
  });

  it('should handle generic types properly', () => {
    interface TestEvent {
      id: number;
      data: string;
    }

    const mockCallback = jest.fn();
    const queue = new DebouncedMessageQueue<TestEvent>({
      callback: mockCallback,
    });

    const testEvent: TestEvent = { id: 1, data: 'test' };
    queue.append(testEvent);

    expect(() => queue.append(testEvent)).not.toThrow();
  });
});
