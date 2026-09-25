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
import { dashboard as dashboardApi } from '@apache-superset/core';
import {
  getActiveAdhocFilters,
  getActiveResolvedFilters,
} from './activeFilters';
import { createWidgetBus } from './bus';
import type { FilterValueChangedPayload } from './filterVocabulary';
import type { WidgetBus } from './types';

const EVENT = dashboardApi.VALUE_CHANGED_EVENT;

const equals = (
  value: string,
  datasource = 1,
  targets?: string[],
): FilterValueChangedPayload => ({
  selection: value,
  resolved: { column: 'region', operator: 'EQUALS', value, datasource },
  ...(targets ? { targets } : {}),
});

let bus: WidgetBus;

beforeEach(() => {
  bus = createWidgetBus();
});

test('a source applies to every other consumer on its dataset', () => {
  bus.emit('filter', EVENT, equals('west'));

  expect(getActiveResolvedFilters(bus, 1, 'chart')).toEqual([
    { column: 'region', operator: 'EQUALS', value: 'west', datasource: 1 },
  ]);
  expect(getActiveAdhocFilters(bus, 1, 'chart')).toEqual([
    {
      expressionType: 'SIMPLE',
      subject: 'region',
      clause: 'WHERE',
      operator: '==',
      comparator: 'west',
    },
  ]);
  expect(getActiveResolvedFilters(bus, 2, 'chart')).toEqual([]);
});

test('a source never filters itself', () => {
  bus.emit('chart', EVENT, equals('west'));

  expect(getActiveResolvedFilters(bus, 1, 'chart')).toEqual([]);
});

test('payload targets narrow a source to the named instances', () => {
  bus.emit('host:region', EVENT, equals('west', 1, ['a']));

  expect(getActiveResolvedFilters(bus, 1, 'a')).toHaveLength(1);
  expect(getActiveResolvedFilters(bus, 1, 'b')).toEqual([]);
});

test('blank targets read as no targets', () => {
  bus.emit('filter', EVENT, equals('west', 1, ['']));

  expect(getActiveResolvedFilters(bus, 1, 'chart')).toHaveLength(1);
});

test("a host's scope for a source wins over the payload's targets", () => {
  const scoped: WidgetBus = {
    ...bus,
    getScopeTargets: sourceId => (sourceId === 'filter' ? ['b'] : undefined),
  };
  bus.emit('filter', EVENT, equals('west', 1, ['a']));

  expect(getActiveResolvedFilters(scoped, 1, 'a')).toEqual([]);
  expect(getActiveResolvedFilters(scoped, 1, 'b')).toHaveLength(1);
});

test('a cleared source no longer applies', () => {
  bus.emit('filter', EVENT, equals('west'));
  bus.emit('filter', EVENT, { selection: null, resolved: null });

  expect(getActiveResolvedFilters(bus, 1, 'chart')).toEqual([]);
});

test('listeners and subscribers hear emits until disposed', () => {
  const listener = jest.fn();
  const subscriber = jest.fn();
  const subscription = bus.on(EVENT, listener);
  const unsubscribe = bus.subscribe(subscriber);

  bus.emit('filter', EVENT, equals('west'));
  subscription.dispose();
  unsubscribe();
  bus.emit('filter', EVENT, equals('east'));

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({
    nodeId: 'filter',
    eventType: EVENT,
    payload: equals('west'),
  });
  expect(subscriber).toHaveBeenCalledTimes(1);
  expect(bus.getRevision()).toBe(2);
});
