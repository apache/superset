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
      this.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          if (typeof this.onmessageerror === 'function') {
            this.onmessageerror(err);
          }
        }
      });
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
    this.queue.forEach(event => {
      this.dispatchEvent(event);
    });
    this.queue = [];
  }

  close() {
    this.isStarted = false;
  }

  onmessage: EventHandler | null = null; // not implemented, requires some kinda proxy thingy to mock correctly

  onmessageerror: ((err: any) => void) | null = null;
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
  let originalConsoleDebug: any = null;
  let originalConsoleError: any = null;

  beforeAll(() => {
    global.MessageChannel = FakeMessageChannel; // yolo
    originalConsoleDebug = console.debug;
    originalConsoleError = console.error;
  });

  beforeEach(() => {
    console.debug = jest.fn(); // silencio bruno
  });

  afterEach(() => {
    console.debug = originalConsoleDebug;
    console.error = originalConsoleError;
  });

  it('constructs with defaults', () => {
    const sb = new Switchboard({ port: new MessageChannel().port1 });
    expect(sb).not.toBeNull();
    expect(sb).toHaveProperty('name');
    expect(sb).toHaveProperty('debugMode');
  });

  describe('emit', () => {
    it('triggers the method', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
      const handler = jest.fn();

      theirs.defineMethod('someEvent', handler);
      theirs.start();

      ours.emit('someEvent', 42);

      expect(handler).toHaveBeenCalledWith(42);
    });

    it('handles a missing method', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
      theirs.start();
      channel.port2.onmessageerror = jest.fn();
      ours.emit('fakemethod');
      await new Promise(setImmediate);
      expect(channel.port2.onmessageerror).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns the value', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
      theirs.defineMethod('theirMethod', ({ x }: { x: number }) =>
        Promise.resolve(x + 42),
      );
      theirs.start();

      const value = await ours.get('theirMethod', { x: 1 });

      expect(value).toEqual(43);
    });

    it('removes the listener after', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
      theirs.defineMethod('theirMethod', () => Promise.resolve(420));
      theirs.start();

      expect((channel.port1 as FakeMessagePort).listeners).toHaveProperty(
        'size',
        1,
      );
      const promise = ours.get('theirMethod');
      expect((channel.port1 as FakeMessagePort).listeners).toHaveProperty(
        'size',
        2,
      );
      await promise;
      expect((channel.port1 as FakeMessagePort).listeners).toHaveProperty(
        'size',
        1,
      );
    });

    it('can handle one way concurrency', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
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
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
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

    it('handles when the method is not defined', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
      theirs.start();
      await expect(ours.get('fakemethod')).rejects.toThrow(
        '[theirs] Method "fakemethod" is not defined',
      );
    });

    it('handles when the method throws', async () => {
      const channel = new MessageChannel();
      const ours = new Switchboard({ port: channel.port1, name: 'ours' });
      const theirs = new Switchboard({ port: channel.port2, name: 'theirs' });
      theirs.defineMethod('failing', () => {
        throw new Error('i dont feel like writing a clever message here');
      });
      theirs.start();

      console.error = jest.fn(); // will be restored by the afterEach
      await expect(ours.get('failing')).rejects.toThrow(
        '[theirs] Method "failing" threw an error',
      );
    });

    it('handles receiving an unexpected non-reply, non-error response', async () => {
      const { port1, port2 } = new MessageChannel();
      const ours = new Switchboard({ port: port1, name: 'ours' });
      // This test is required for 100% coverage. But there's no way to set up these conditions
      // within the switchboard interface, so we gotta hack together the ports directly.
      port2.addEventListener('message', event => {
        const { messageId } = event.data;
        port1.dispatchEvent({ data: { messageId } } as MessageEvent);
      });
      port2.start();

      await expect(ours.get('someMethod')).rejects.toThrowError(
        'Unexpected response message',
      );
    });
  });

  it('logs in debug mode', async () => {
    const { port1, port2 } = new MessageChannel();
    const ours = new Switchboard({
      port: port1,
      name: 'ours',
      debug: true,
    });
    const theirs = new Switchboard({
      port: port2,
      name: 'theirs',
      debug: true,
    });
    theirs.defineMethod('blah', () => {});
    theirs.start();
    await ours.emit('blah');
    expect(console.debug).toHaveBeenCalledTimes(1);
    expect((console.debug as any).mock.calls[0][0]).toBe('[theirs]');
  });

  it('does not log outside debug mode', async () => {
    const { port1, port2 } = new MessageChannel();
    const ours = new Switchboard({
      port: port1,
      name: 'ours',
    });
    const theirs = new Switchboard({
      port: port2,
      name: 'theirs',
    });
    theirs.defineMethod('blah', () => {});
    theirs.start();
    await ours.emit('blah');
    expect(console.debug).toHaveBeenCalledTimes(0);
  });
});
