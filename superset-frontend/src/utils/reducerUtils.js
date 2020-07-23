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

export function addToObject(state, arrKey, obj) {
  const newObject = { ...state[arrKey] };
  const copiedObject = { ...obj };

  if (!copiedObject.id) {
    copiedObject.id = shortid.generate();
  }
  newObject[copiedObject.id] = copiedObject;
  return { ...state, [arrKey]: newObject };
}

export function alterInObject(state, arrKey, obj, alterations) {
  const newObject = { ...state[arrKey] };
  newObject[obj.id] = { ...newObject[obj.id], ...alterations };
  return { ...state, [arrKey]: newObject };
}

export function alterInArr(state, arrKey, obj, alterations) {
  // Finds an item in an array in the state and replaces it with a
  // new object with an altered property
  const idKey = 'id';
  const newArr = [];
  state[arrKey].forEach(arrItem => {
    if (obj[idKey] === arrItem[idKey]) {
      newArr.push({ ...arrItem, ...alterations });
    } else {
      newArr.push(arrItem);
    }
  });
  return { ...state, [arrKey]: newArr };
}

export function removeFromArr(state, arrKey, obj, idKey = 'id') {
  const newArr = [];
  state[arrKey].forEach(arrItem => {
    if (!(obj[idKey] === arrItem[idKey])) {
      newArr.push(arrItem);
    }
  });
  return { ...state, [arrKey]: newArr };
}

export function addToArr(state, arrKey, obj) {
  const newObj = { ...obj };
  if (!newObj.id) {
    newObj.id = shortid.generate();
  }
  const newState = {};
  newState[arrKey] = [...state[arrKey], newObj];
  return { ...state, ...newState };
}
