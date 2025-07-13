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
import { debounce } from 'lodash';

interface DebouncedMessageQueueConfig {
  callback?: (events: any[]) => void;
  sizeThreshold?: number;
  delayThreshold?: number;
}

class DebouncedMessageQueue {
  private queue: any[];

  private sizeThreshold: number;

  private delayThreshold: number;

  private callback: (events: any[]) => void;

  private trigger: () => void;

  constructor({
    callback = () => {},
    sizeThreshold = 1000,
    delayThreshold = 1000,
  }: DebouncedMessageQueueConfig = {}) {
    this.queue = [];
    this.sizeThreshold = sizeThreshold;
    this.delayThreshold = delayThreshold;

    this.trigger = debounce(this.triggerQueue.bind(this), this.delayThreshold);
    this.callback = callback;
  }

  append(eventData: any): void {
    this.queue.push(eventData);
    this.trigger();
  }

  private triggerQueue(): void {
    if (this.queue.length > 0) {
      const events = this.queue.splice(0, this.sizeThreshold);
      this.callback.call(null, events);

      // If there are remaining items, call it again.
      if (this.queue.length > 0) {
        this.triggerQueue();
      }
    }
  }
}

export default DebouncedMessageQueue;
