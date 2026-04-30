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

import { rectIntersection, pointerWithin, closestCenter } from '@dnd-kit/core';
import type { CollisionDescriptor } from '@dnd-kit/core';
import { getCollisionDetection } from './sensors';

jest.mock('@dnd-kit/core', () => {
  const actual = jest.requireActual('@dnd-kit/core');
  return {
    ...actual,
    rectIntersection: jest.fn(),
    pointerWithin: jest.fn(),
    closestCenter: jest.fn(),
  };
});

const mockRectIntersection = rectIntersection as jest.Mock;
const mockPointerWithin = pointerWithin as jest.Mock;
const mockClosestCenter = closestCenter as jest.Mock;

const collision = (id: string): CollisionDescriptor => ({
  id,
  data: { droppableContainer: { id } as any, value: 0 },
});

const dummyArgs = {} as any;

test('returns rectIntersection when activeId is null', () => {
  const detector = getCollisionDetection(null);
  expect(detector).toBe(rectIntersection);
});

test('returns rectIntersection result when best match is not the active item', () => {
  const detector = getCollisionDetection('active-1');
  const collisions = [collision('other-item'), collision('active-1')];
  mockRectIntersection.mockReturnValue(collisions);

  const result = detector(dummyArgs);

  expect(result).toBe(collisions);
  expect(mockPointerWithin).not.toHaveBeenCalled();
  expect(mockClosestCenter).not.toHaveBeenCalled();
});

test('returns rectIntersection result when collisions array is empty', () => {
  const detector = getCollisionDetection('active-1');
  mockRectIntersection.mockReturnValue([]);

  const result = detector(dummyArgs);

  expect(result).toEqual([]);
  expect(mockPointerWithin).not.toHaveBeenCalled();
});

test('falls back to pointerWithin when rectIntersection picks the active item', () => {
  const detector = getCollisionDetection('active-1');
  const activeCollision = collision('active-1');
  const otherCollision = collision('other-item');
  mockRectIntersection.mockReturnValue([activeCollision]);
  mockPointerWithin.mockReturnValue([otherCollision]);

  const result = detector(dummyArgs);

  expect(result).toEqual([otherCollision, activeCollision]);
  expect(mockClosestCenter).not.toHaveBeenCalled();
});

test('keeps rectIntersection result when pointerWithin also finds only the active item', () => {
  const detector = getCollisionDetection('active-1');
  const activeCollision = collision('active-1');
  mockRectIntersection.mockReturnValue([activeCollision]);
  mockPointerWithin.mockReturnValue([collision('active-1')]);

  const result = detector(dummyArgs);

  expect(result).toEqual([activeCollision]);
  expect(mockClosestCenter).not.toHaveBeenCalled();
});

test('falls back to closestCenter when pointerWithin returns empty', () => {
  const detector = getCollisionDetection('active-1');
  const activeCollision = collision('active-1');
  const centerCollision = collision('nearby-item');
  mockRectIntersection.mockReturnValue([activeCollision]);
  mockPointerWithin.mockReturnValue([]);
  mockClosestCenter.mockReturnValue([centerCollision]);

  const result = detector(dummyArgs);

  expect(result).toEqual([centerCollision, activeCollision]);
});

test('returns rectIntersection result when all fallbacks only find the active item', () => {
  const detector = getCollisionDetection('active-1');
  const activeCollision = collision('active-1');
  mockRectIntersection.mockReturnValue([activeCollision]);
  mockPointerWithin.mockReturnValue([]);
  mockClosestCenter.mockReturnValue([collision('active-1')]);

  const result = detector(dummyArgs);

  expect(result).toEqual([activeCollision]);
});
