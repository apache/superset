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

import { Switchboard } from './switchboard';

type EventHandler = (event: MessageEvent) => void;

// A note on these fakes:
//
// jsdom doesn't supply a MessageChannel or a MessagePort,
// so we have to build our own unless we want to unit test in-browser.
// Might want to open a PR in jsdom: https://github.com/jsdom/jsdom/issues/2448

/** Matches the MessagePort api as closely as necessary (it's a small api) */
class FakeMessagePort {
  otherPort?: FakeMessagePort;
  isStarted = false;
  queue: MessageEvent[] = [];
  listeners: Set<EventHandler> = new Set();

  dispatchEvent(event: MessageEvent) {
    if (this.isStarted) {
      for (let listener of this.listeners) {
        try {
          listener(event);
        } catch (err) {
          // whatever browsers do here, idk
        }
      }
    } else {
      this.queue.push(event);
    }
    return true;
  }

  addEventListener(eventType: 'message', handler: EventHandler) {
    this.listeners.add(handler);
  }

  removeEventListener(eventType: 'message', handler: EventHandler) {
    this.listeners.delete(handler);
  }

  postMessage(data: any) {
    this.otherPort!.dispatchEvent({ data } as MessageEvent);
  }

  start() {
    if (this.isStarted) return;
    this.isStarted = true;
    for (let event of this.queue) {
      this.dispatchEvent(event);
    }
    this.queue = [];
  }

  close() {
    this.isStarted = false;
  }

  onmessage = null;
  onmessageerror = null;
}

/** Matches the MessageChannel api as closely as necessary (an even smaller api than MessagePort) */
class FakeMessageChannel {
  port1: MessagePort;
  port2: MessagePort;

  constructor() {
    const port1 = new FakeMessagePort();
    const port2 = new FakeMessagePort();
    port1.otherPort = port2;
    port2.otherPort = port1;
    this.port1 = port1;
    this.port2 = port2;
  }
}

describe('comms', () => {
  beforeAll(() => {
    global.MessageChannel = FakeMessageChannel; // yolo
    console.debug = () => {}; // silencio bruno
  });

  describe('emit', () => {
    it('triggers the method', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard(channel.port1, 'ours');
      const theirs = new Switchboard(channel.port2, 'theirs');
      const handler = jest.fn();

      theirs.defineMethod('someEvent', handler);
      theirs.start();

      ours.emit('someEvent', 42);

      expect(handler).toHaveBeenCalledWith(42);
    });
  });

  describe('get', () => {
    it('returns the value', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard(channel.port1, 'ours');
      const theirs = new Switchboard(channel.port2, 'theirs');
      theirs.defineMethod('theirMethod', ({ x }: { x: number }) =>
        Promise.resolve(x + 42),
      );
      theirs.start();

      const value = await ours.get('theirMethod', { x: 1 });

      expect(value).toEqual(43);
    });

    it('can handle one way concurrency', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard(channel.port1, 'ours');
      const theirs = new Switchboard(channel.port2, 'theirs');
      theirs.defineMethod('theirMethod', () => Promise.resolve(42));
      theirs.defineMethod(
        'theirMethod2',
        () => new Promise(resolve => setImmediate(() => resolve(420))),
      );
      theirs.start();

      const [value1, value2] = await Promise.all([
        ours.get('theirMethod'),
        ours.get('theirMethod2'),
      ]);

      expect(value1).toEqual(42);
      expect(value2).toEqual(420);
    });

    it('can handle two way concurrency', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard(channel.port1, 'ours');
      const theirs = new Switchboard(channel.port2, 'theirs');
      theirs.defineMethod('theirMethod', () => Promise.resolve(42));
      ours.defineMethod(
        'ourMethod',
        () => new Promise(resolve => setImmediate(() => resolve(420))),
      );
      theirs.start();

      const [value1, value2] = await Promise.all([
        ours.get('theirMethod'),
        theirs.get('ourMethod'),
      ]);

      expect(value1).toEqual(42);
      expect(value2).toEqual(420);
    });
  });
});
