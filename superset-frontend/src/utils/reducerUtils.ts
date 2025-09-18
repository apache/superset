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
import { nanoid } from 'nanoid';

export interface ObjectWithId {
  id?: string;
  [key: string]: unknown;
}

export interface StateWithObjects<T = ObjectWithId> {
  [key: string]: Record<string, T> | T[] | unknown;
}

export interface StateWithArrays<T = ObjectWithId> {
  [key: string]: T[] | Record<string, T> | unknown;
}

export function addToObject<T extends ObjectWithId>(
  state: StateWithObjects<T>,
  arrKey: string,
  obj: T,
): StateWithObjects<T> {
  const newObject = { ...(state[arrKey] as Record<string, T>) };
  const copiedObject = { ...obj };

  if (!copiedObject.id) {
    copiedObject.id = nanoid();
  }
  newObject[copiedObject.id] = copiedObject;
  return { ...state, [arrKey]: newObject };
}

export function alterInObject<T extends ObjectWithId>(
  state: StateWithObjects<T>,
  arrKey: string,
  obj: T,
  alterations: Partial<T>,
): StateWithObjects<T> {
  const newObject = { ...(state[arrKey] as Record<string, T>) };
  newObject[obj.id!] = { ...newObject[obj.id!], ...alterations };
  return { ...state, [arrKey]: newObject };
}

export function alterInArr<T extends ObjectWithId>(
  state: StateWithArrays<T>,
  arrKey: string,
  obj: T,
  alterations: Partial<T>,
): StateWithArrays<T> {
  // Finds an item in an array in the state and replaces it with a
  // new object with an altered property
  const idKey = 'id' as keyof T;
  const newArr: T[] = [];
  (state[arrKey] as T[]).forEach((arrItem: T) => {
    if (obj[idKey] === arrItem[idKey]) {
      newArr.push({ ...arrItem, ...alterations });
    } else {
      newArr.push(arrItem);
    }
  });
  return { ...state, [arrKey]: newArr };
}

export function removeFromArr<T extends Record<string, unknown>>(
  state: StateWithArrays<T>,
  arrKey: string,
  obj: T,
  idKey: keyof T = 'id',
): StateWithArrays<T> {
  const newArr: T[] = [];
  (state[arrKey] as T[]).forEach((arrItem: T) => {
    if (!(obj[idKey] === arrItem[idKey])) {
      newArr.push(arrItem);
    }
  });
  return { ...state, [arrKey]: newArr };
}

export function addToArr<T extends ObjectWithId>(
  state: StateWithArrays<T>,
  arrKey: string,
  obj: T,
): StateWithArrays<T> {
  const newObj = { ...obj };
  if (!newObj.id) {
    newObj.id = nanoid();
  }
  const newState: Partial<StateWithArrays<T>> = {};
  newState[arrKey] = [...(state[arrKey] as T[]), newObj];
  return { ...state, ...newState };
}
