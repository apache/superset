import { ADD_TOAST, REMOVE_TOAST } from '../actions/messageToasts';

export default function messageToastsReducer(toasts = [], action) {
  switch (action.type) {
    case ADD_TOAST: {
      const { payload: { id, type, text } } = action;
      return [...toasts, { id, type, text }];
    }

    case REMOVE_TOAST: {
      const { payload: { id } } = action;
      return [...toasts].filter(toast => toast.id !== id);
    }

    default:
      return toasts;
  }
}
