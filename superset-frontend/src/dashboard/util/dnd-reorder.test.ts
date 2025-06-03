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
import reorderItem from 'src/dashboard/util/dnd-reorder';
import { TABS_TYPE } from './componentTypes';
import { DROP_LEFT, DROP_RIGHT } from './getDropPosition';

describe('dnd-reorderItem', () => {
  it('should remove the item from its source entity and add it to its destination entity', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
        b: {
          id: 'b',
          children: ['banana'],
        },
      },
      source: { id: 'a', index: 2 },
      destination: { id: 'b', index: 1 },
    });

    expect(result.a.children).toEqual(['x', 'y']);
    expect(result.b.children).toEqual(['banana', 'z']);
  });

  it('should correctly move elements within the same list', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
      },
      source: { id: 'a', index: 2 },
      destination: { id: 'a', index: 0 },
    });

    expect(result.a.children).toEqual(['z', 'x', 'y']);
  });

  it('should copy items that do not move into the result', () => {
    const extraEntity = {};
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
        b: {
          id: 'b',
          children: ['banana'],
        },
        iAmExtra: extraEntity,
      },
      source: { id: 'a', index: 2 },
      destination: { id: 'b', index: 1 },
    });

    expect(result.iAmExtra).toBe(extraEntity);
  });

  it('should handle out of bounds destination index gracefully', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
        b: {
          id: 'b',
          children: ['banana'],
        },
      },
      source: { id: 'a', index: 1 },
      destination: { id: 'b', index: 5 },
    });

    expect(result.a.children).toEqual(['x', 'z']);
    expect(result.b.children).toEqual(['banana', 'y']);
  });

  it('should do nothing if source and destination are the same and indices are the same', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
      },
      source: { id: 'a', index: 1 },
      destination: { id: 'a', index: 1 },
    });

    expect(result.a.children).toEqual(['x', 'y', 'z']);
  });

  it('should handle DROP_LEFT in the same TABS_TYPE list correctly', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          type: TABS_TYPE,
          children: ['x', 'y', 'z'],
        },
      },
      source: { id: 'a', type: TABS_TYPE, index: 2 },
      destination: { id: 'a', type: TABS_TYPE, index: 1 },
      position: DROP_LEFT,
    });

    expect(result.a.children).toEqual(['x', 'z', 'y']);
  });

  it('should handle DROP_RIGHT in the same TABS_TYPE list correctly', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          type: TABS_TYPE,
          children: ['x', 'y', 'z'],
        },
      },
      source: { id: 'a', type: TABS_TYPE, index: 0 },
      destination: { id: 'a', type: TABS_TYPE, index: 1 },
      position: DROP_RIGHT,
    });

    expect(result.a.children).toEqual(['y', 'x', 'z']);
  });

  it('should handle DROP_LEFT when moving between different TABS_TYPE lists', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          type: TABS_TYPE,
          children: ['x', 'y'],
        },
        b: {
          id: 'b',
          type: TABS_TYPE,
          children: ['banana'],
        },
      },
      source: { id: 'a', type: TABS_TYPE, index: 1 },
      destination: { id: 'b', type: TABS_TYPE, index: 0 },
      position: DROP_LEFT,
    });

    expect(result.a.children).toEqual(['x']);
    expect(result.b.children).toEqual(['y', 'banana']);
  });

  it('should handle DROP_RIGHT when moving between different TABS_TYPE lists', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          type: TABS_TYPE,
          children: ['x', 'y'],
        },
        b: {
          id: 'b',
          type: TABS_TYPE,
          children: ['banana'],
        },
      },
      source: { id: 'a', type: TABS_TYPE, index: 0 },
      destination: { id: 'b', type: TABS_TYPE, index: 0 },
      position: DROP_RIGHT,
    });

    expect(result.a.children).toEqual(['y']);
    expect(result.b.children).toEqual(['banana', 'x']);
  });
});
