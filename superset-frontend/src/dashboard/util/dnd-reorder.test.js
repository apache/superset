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

    expect(result.iAmExtra === extraEntity).toBe(true);
  });
});
