import shortid from 'shortid';

import {
  INFO_TOAST,
  SUCCESS_TOAST,
  WARNING_TOAST,
  DANGER_TOAST,
} from '../constants';

export function getToastUuid(type) {
  return `${type}-${shortid.generate()}`;
}

export const ADD_TOAST = 'ADD_TOAST';
export function addToast({ toastType, text, duration = 8000 }) {
  return {
    type: ADD_TOAST,
    payload: {
      id: getToastUuid(toastType),
      toastType,
      text,
      duration,
    },
  };
}

export const REMOVE_TOAST = 'REMOVE_TOAST';
export function removeToast(id) {
  return {
    type: REMOVE_TOAST,
    payload: {
      id,
    },
  };
}

// Different types of toasts
export const ADD_INFO_TOAST = 'ADD_INFO_TOAST';
export function addInfoToast(text) {
  return dispatch =>
    dispatch(addToast({ text, toastType: INFO_TOAST, duration: 4000 }));
}

export const ADD_SUCCESS_TOAST = 'ADD_SUCCESS_TOAST';
export function addSuccessToast(text) {
  return dispatch =>
    dispatch(addToast({ text, toastType: SUCCESS_TOAST, duration: 4000 }));
}

export const ADD_WARNING_TOAST = 'ADD_WARNING_TOAST';
export function addWarningToast(text) {
  return dispatch =>
    dispatch(addToast({ text, toastType: WARNING_TOAST, duration: 6000 }));
}

export const ADD_DANGER_TOAST = 'ADD_DANGER_TOAST';
export function addDangerToast(text) {
  return dispatch =>
    dispatch(addToast({ text, toastType: DANGER_TOAST, duration: 8000 }));
}
