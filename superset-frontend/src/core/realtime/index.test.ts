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
  dispatchRealtimeMessage,
  emitRealtimeOpenForTests,
  resetRealtimeForTests,
} from 'src/middleware/realtime';
import { entityChangeOf, realtime } from '.';

const nudge = (payload: unknown, topic = 'entity.changed') =>
  dispatchRealtimeMessage(JSON.stringify({ topic, payload }));

afterEach(() => {
  resetRealtimeForTests();
});

test('onDidChangeEntity hands a listener each nudge as an entity change', () => {
  const listener = jest.fn();
  realtime.onDidChangeEntity(listener);

  nudge({ entity_type: 'canvas', id: 7 });
  nudge({ entity_type: 'widget', id: '0b6c4a52-7e1f-4f0e-9d55-3c0f0e5b9a11' });

  expect(listener.mock.calls).toEqual([
    [{ entityType: 'canvas', id: 7 }],
    [{ entityType: 'widget', id: '0b6c4a52-7e1f-4f0e-9d55-3c0f0e5b9a11' }],
  ]);
});

test('onDidChangeEntity skips malformed nudges and other topics', () => {
  const listener = jest.fn();
  realtime.onDidChangeEntity(listener);

  nudge(null);
  nudge('canvas:7');
  nudge({ id: 7 });
  nudge({ entity_type: '', id: 7 });
  nudge({ entity_type: 'canvas' });
  nudge({ entity_type: 'canvas', id: { nested: true } });
  nudge({ task_id: 'a' }, 'task.status');

  expect(listener).not.toHaveBeenCalled();
});

test('disposing an entity subscription stops its listener alone', () => {
  const kept = jest.fn();
  const dropped = jest.fn();
  realtime.onDidChangeEntity(kept);
  const subscription = realtime.onDidChangeEntity(dropped);

  subscription.dispose();
  nudge({ entity_type: 'canvas', id: 7 });

  expect(kept).toHaveBeenCalledTimes(1);
  expect(dropped).not.toHaveBeenCalled();
});

test('a listener that throws stops no other listener', () => {
  const after = jest.fn();
  realtime.onDidChangeEntity(() => {
    throw new Error('broken extension');
  });
  realtime.onDidChangeEntity(after);

  expect(() => nudge({ entity_type: 'canvas', id: 7 })).not.toThrow();
  expect(after).toHaveBeenCalledWith({ entityType: 'canvas', id: 7 });
});

test('onDidChangeEntity calls its listener on thisArgs', () => {
  const target = { seen: [] as unknown[] };
  realtime.onDidChangeEntity(function record(
    this: typeof target,
    change: unknown,
  ) {
    this.seen.push(change);
  }, target);

  nudge({ entity_type: 'task', id: 3 });

  expect(target.seen).toEqual([{ entityType: 'task', id: 3 }]);
});

test('onDidReconnect fires on a reconnect, not on the first connect or a rebind', () => {
  const listener = jest.fn();
  realtime.onDidReconnect(listener);

  emitRealtimeOpenForTests('initial');
  emitRealtimeOpenForTests('rebind');
  expect(listener).not.toHaveBeenCalled();

  emitRealtimeOpenForTests('reconnect');
  expect(listener).toHaveBeenCalledTimes(1);
});

test('disposing a reconnect subscription stops its listener', () => {
  const listener = jest.fn();
  realtime.onDidReconnect(listener).dispose();

  emitRealtimeOpenForTests('reconnect');

  expect(listener).not.toHaveBeenCalled();
});

test('entityChangeOf refuses an id that is not a finite number or a string', () => {
  expect(entityChangeOf({ entity_type: 'canvas', id: Number.NaN })).toBe(
    undefined,
  );
  expect(entityChangeOf({ entity_type: 'canvas', id: true })).toBe(undefined);
  expect(entityChangeOf({ entity_type: 'canvas', id: '' })).toBe(undefined);
  expect(entityChangeOf({ entity_type: 'canvas', id: 0 })).toEqual({
    entityType: 'canvas',
    id: 0,
  });
});
