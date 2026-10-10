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
  addToObject,
  alterInObject,
  alterInArr,
  removeFromArr,
  addToArr,
} from './reducerUtils';

interface TestItem {
  id?: string;
  name: string;
  value: number;
}

const mockState = {
  objects: {
    'item-1': { id: 'item-1', name: 'Item 1', value: 10 },
    'item-2': { id: 'item-2', name: 'Item 2', value: 20 },
  },
  items: [
    { id: 'item-1', name: 'Item 1', value: 10 },
    { id: 'item-2', name: 'Item 2', value: 20 },
  ],
};

test('addToObject adds new object to state with generated id', () => {
  const newItem: TestItem = { name: 'New Item', value: 30 };
  const result = addToObject(mockState, 'objects', newItem);

  expect(result).not.toBe(mockState);
  expect(result.objects).not.toBe(mockState.objects);
  expect(Object.keys(result.objects)).toHaveLength(3);

  const addedItems = Object.values(result.objects).filter(
    item => (item as TestItem).name === 'New Item',
  );
  expect(addedItems).toHaveLength(1);
  expect((addedItems[0] as TestItem).id).toBeTruthy();
});

test('addToObject adds new object with existing id', () => {
  const newItem: TestItem = { id: 'item-3', name: 'Item 3', value: 30 };
  const result = addToObject(mockState, 'objects', newItem);

  expect(result.objects['item-3']).toEqual(newItem);
});

test('alterInObject modifies existing object', () => {
  const targetItem: TestItem = { id: 'item-1', name: 'Item 1', value: 10 };
  const alterations = { value: 15 };
  const result = alterInObject(mockState, 'objects', targetItem, alterations);

  expect(result.objects['item-1'].value).toBe(15);
  expect(result.objects['item-1'].name).toBe('Item 1');
  expect(result.objects['item-2']).toBe(mockState.objects['item-2']);
});

test('alterInArr modifies existing array item', () => {
  const targetItem: TestItem = { id: 'item-1', name: 'Item 1', value: 10 };
  const alterations = { value: 15 };
  const result = alterInArr(mockState, 'items', targetItem, alterations);

  expect(result.items[0].value).toBe(15);
  expect(result.items[0].name).toBe('Item 1');
  expect(result.items[1]).toBe(mockState.items[1]);
});

test('removeFromArr removes item from array', () => {
  const targetItem: TestItem = { id: 'item-1', name: 'Item 1', value: 10 };
  const result = removeFromArr(mockState, 'items', targetItem);

  expect(result.items).toHaveLength(1);
  expect(result.items[0].id).toBe('item-2');
});

test('removeFromArr with custom idKey', () => {
  const stateWithCustomKey = {
    items: [
      { customId: 'a', name: 'Item A' },
      { customId: 'b', name: 'Item B' },
    ],
  };
  const targetItem = { customId: 'a', name: 'Item A' };
  const result = removeFromArr(
    stateWithCustomKey,
    'items',
    targetItem,
    'customId',
  );

  expect(result.items).toHaveLength(1);
  expect(result.items[0].customId).toBe('b');
});

test('addToArr adds new item to array with generated id', () => {
  const newItem: TestItem = { name: 'New Item', value: 30 };
  const result = addToArr(mockState, 'items', newItem);

  expect(result.items).toHaveLength(3);
  expect(result.items[2].name).toBe('New Item');
  expect(result.items[2].id).toBeTruthy();
});

test('addToArr adds new item with existing id', () => {
  const newItem: TestItem = { id: 'item-3', name: 'Item 3', value: 30 };
  const result = addToArr(mockState, 'items', newItem);

  expect(result.items).toHaveLength(3);
  expect(result.items[2]).toEqual(newItem);
});
