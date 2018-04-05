import { INFO_TOAST, SUCCESS_TOAST, WARNING_TOAST, DANGER_TOAST } from '../util/constants';

function getToastUuid(type) {
  return `${Math.random().toString(16).slice(2)}-${type}-${Math.random().toString(16).slice(2)}`;
}

export const ADD_TOAST = 'ADD_TOAST';
export function addToast({ toastType, text }) {
  debugger;
  return {
    type: ADD_TOAST,
    payload: {
      id: getToastUuid(toastType),
      toastType,
      text,
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
  return dispatch => dispatch(addToast({ text, toastType: INFO_TOAST }));
}

export const ADD_SUCCESS_TOAST = 'ADD_SUCCESS_TOAST';
export function addSuccessToast(text) {
  return dispatch => dispatch(addToast({ text, toastType: SUCCESS_TOAST }));
}

export const ADD_WARNING_TOAST = 'ADD_WARNING_TOAST';
export function addWarningToast(text) {
  return dispatch => dispatch(addToast({ text, toastType: WARNING_TOAST }));
}

export const ADD_DANGER_TOAST = 'ADD_DANGER_TOAST';
export function addDangerToast(text) {
  return dispatch => dispatch(addToast({ text, toastType: DANGER_TOAST }));
}
