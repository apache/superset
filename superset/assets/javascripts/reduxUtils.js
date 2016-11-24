import shortid from 'shortid';
import { compose } from 'redux';
import persistState from 'redux-localstorage';

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

export function alterInArr(state, arrKey, obj, alterations) {
  // Finds an item in an array in the state and replaces it with a
  // new object with an altered property
  const idKey = 'id';
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

export function addToArr(state, arrKey, obj) {
  const newObj = Object.assign({}, obj);
  if (!newObj.id) {
    newObj.id = shortid.generate();
  }
  const newState = {};
  newState[arrKey] = [...state[arrKey], newObj];
  return Object.assign({}, state, newState);
}

export function enhancer() {
  let enhancerWithPersistState = compose(persistState());
  if (process.env.NODE_ENV === 'dev') {
    /* eslint-disable no-underscore-dangle */
    const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    /* eslint-enable */
    enhancerWithPersistState = composeEnhancers(persistState());
  }
  return enhancerWithPersistState;
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
  if (!obj1 || !obj2) {
    return false;
  }
  if (! Object.keys(obj1).length !== Object.keys(obj2).length) {
    return false;
  }
  for (const id in obj1) {
    if (!obj2.hasOwnProperty(id)) {
      return false;
    }
    if (obj1[id] !== obj2[id]) {
      return false;
    }
  }
  return true;
}
