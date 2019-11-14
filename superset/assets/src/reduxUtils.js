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
import persistState from 'redux-localstorage';
import { isEqual } from 'lodash';

export function addToObject(state, arrKey, obj) {
  const newObject = Object.assign({}, state[arrKey]);
  const copiedObject = Object.assign({}, obj);

  if (!copiedObject.id) {
    copiedObject.id = shortid.generate();
  }
  newObject[copiedObject.id] = copiedObject;
  return Object.assign({}, state, { [arrKey]: newObject });
}

export function alterInObject(state, arrKey, obj, alterations) {
  const newObject = Object.assign({}, state[arrKey]);
  newObject[obj.id] = Object.assign({}, newObject[obj.id], alterations);
  return Object.assign({}, state, { [arrKey]: newObject });
}

export function alterInArr(state, arrKey, obj, alterations, idKey = 'id') {
  // Finds an item in an array in the state and replaces it with a
  // new object with an altered property
  const newArr = [];
  state[arrKey].forEach((arrItem) => {
    if (obj[idKey] === arrItem[idKey]) {
      newArr.push(Object.assign({}, arrItem, alterations));
    } else {
      newArr.push(arrItem);
    }
  });
  return Object.assign({}, state, { [arrKey]: newArr });
}

export function removeFromArr(state, arrKey, obj, idKey = 'id') {
  const newArr = [];
  state[arrKey].forEach((arrItem) => {
    if (!(obj[idKey] === arrItem[idKey])) {
      newArr.push(arrItem);
    }
  });
  return Object.assign({}, state, { [arrKey]: newArr });
}

export function getFromArr(arr, id) {
  let obj;
  arr.forEach((o) => {
    if (o.id === id) {
      obj = o;
    }
  });
  return obj;
}

export function addToArr(state, arrKey, obj, prepend = false) {
  const newObj = Object.assign({}, obj);
  if (!newObj.id) {
    newObj.id = shortid.generate();
  }
  const newState = {};
  if (prepend) {
    newState[arrKey] = [newObj, ...state[arrKey]];
  } else {
    newState[arrKey] = [...state[arrKey], newObj];
  }
  return Object.assign({}, state, newState);
}

export function extendArr(state, arrKey, obj, prepend = false) {
  const newObj = [...obj];
  newObj.forEach((el) => {
    if (!el.id) {
      /* eslint-disable no-param-reassign */
      el.id = shortid.generate();
    }
  });
  const newState = {};
  if (prepend) {
    newState[arrKey] = [...newObj, ...state[arrKey]];
  } else {
    newState[arrKey] = [...state[arrKey], ...newObj];
  }
  return Object.assign({}, state, newState);
}

export function initEnhancer(persist = true, persistConfig = {}) {
  const { paths, config } = persistConfig;
  const composeEnhancers = process.env.WEBPACK_MODE === 'development'
    /* eslint-disable-next-line no-underscore-dangle */
    ? (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose)
    : compose;

  return persist
    ? composeEnhancers(persistState(paths, config))
    : composeEnhancers();
}

export function areArraysShallowEqual(arr1, arr2) {
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

export function areObjectsEqual(obj1, obj2) {
  return isEqual(obj1, obj2);
}
