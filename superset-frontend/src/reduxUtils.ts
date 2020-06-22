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
import shortid from 'shortid';
import { compose } from 'redux';
import persistState, { StorageAdapter } from 'redux-localstorage';
import { isEqual } from 'lodash';

export function addToObject(
  state: Record<string, any>,
  arrKey: string,
  obj: Record<string, any>,
) {
  const newObject = { ...state[arrKey] };
  const copiedObject = { ...obj };

  if (!copiedObject.id) {
    copiedObject.id = shortid.generate();
  }
  newObject[copiedObject.id] = copiedObject;
  return { ...state, [arrKey]: newObject };
}

export function alterInObject(
  state: Record<string, any>,
  arrKey: string,
  obj: Record<string, any>,
  alterations: Record<string, any>,
) {
  const newObject = { ...state[arrKey] };
  newObject[obj.id] = { ...newObject[obj.id], ...alterations };
  return { ...state, [arrKey]: newObject };
}

export function alterInArr(
  state: Record<string, any>,
  arrKey: string,
  obj: Record<string, any>,
  alterations: Record<string, any>,
  idKey = 'id',
) {
  // Finds an item in an array in the state and replaces it with a
  // new object with an altered property
  const newArr: unknown[] = [];
  state[arrKey].forEach((arrItem: Record<string, any>) => {
    if (obj[idKey] === arrItem[idKey]) {
      newArr.push({ ...arrItem, ...alterations });
    } else {
      newArr.push(arrItem);
    }
  });
  return { ...state, [arrKey]: newArr };
}

export function removeFromArr(
  state: Record<string, any>,
  arrKey: string,
  obj: Record<string, any>,
  idKey = 'id',
) {
  const newArr: unknown[] = [];
  state[arrKey].forEach((arrItem: Record<string, any>) => {
    if (!(obj[idKey] === arrItem[idKey])) {
      newArr.push(arrItem);
    }
  });
  return { ...state, [arrKey]: newArr };
}

export function getFromArr(arr: Record<string, any>[], id: string) {
  let obj;
  arr.forEach(o => {
    if (o.id === id) {
      obj = o;
    }
  });
  return obj;
}

export function addToArr(
  state: Record<string, any>,
  arrKey: string,
  obj: Record<string, any>,
  prepend = false,
) {
  const newObj = { ...obj };
  if (!newObj.id) {
    newObj.id = shortid.generate();
  }
  const newState = {};
  if (prepend) {
    newState[arrKey] = [newObj, ...state[arrKey]];
  } else {
    newState[arrKey] = [...state[arrKey], newObj];
  }
  return { ...state, ...newState };
}

export function extendArr(
  state: Record<string, any>,
  arrKey: string,
  arr: Record<string, any>[],
  prepend = false,
) {
  const newArr = [...arr];
  newArr.forEach(el => {
    if (!el.id) {
      /* eslint-disable no-param-reassign */
      el.id = shortid.generate();
    }
  });
  const newState = {};
  if (prepend) {
    newState[arrKey] = [...newArr, ...state[arrKey]];
  } else {
    newState[arrKey] = [...state[arrKey], ...newArr];
  }
  return { ...state, ...newState };
}

export function initEnhancer(
  persist = true,
  persistConfig: { paths?: StorageAdapter<unknown>; config?: string } = {},
) {
  const { paths, config } = persistConfig;
  const composeEnhancers =
    process.env.WEBPACK_MODE === 'development'
      ? /* eslint-disable-next-line no-underscore-dangle, dot-notation */
        window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'] || compose
      : compose;

  return persist
    ? composeEnhancers(persistState(paths, config))
    : composeEnhancers();
}

export function areArraysShallowEqual(arr1: unknown[], arr2: unknown[]) {
  // returns whether 2 arrays are shallow equal
  // used in shouldComponentUpdate when denormalizing arrays
  // where the array object is different every time, but the content might
  // be the same
  if (!arr1 || !arr2) {
    return false;
  }
  if (arr1.length !== arr2.length) {
    return false;
  }
  const length = arr1.length;
  for (let i = 0; i < length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

export function areObjectsEqual(
  obj1: Record<string, any>,
  obj2: Record<string, any>,
) {
  return isEqual(obj1, obj2);
}
