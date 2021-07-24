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

class DebouncedMessageQueue {
  constructor({
    callback = () => {},
    sizeThreshold = 1000,
    delayThreshold = 1000,
  }) {
    this.queue = [];
    this.sizeThreshold = sizeThreshold;
    this.delayThrehold = delayThreshold;

    this.trigger = debounce(this.trigger.bind(this), this.delayThrehold);
    this.callback = callback;
  }

  append(eventData) {
    this.queue.push(eventData);
    this.trigger();
  }

  trigger() {
    if (this.queue.length > 0) {
      const events = this.queue.splice(0, this.sizeThreshold);
      this.callback.call(null, events);

      // If there are remaining items, call it again.
      if (this.queue.length > 0) {
        this.trigger();
      }
    }
  }
}

export default DebouncedMessageQueue;
