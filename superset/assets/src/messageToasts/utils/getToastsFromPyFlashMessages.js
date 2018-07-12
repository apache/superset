import { addToast } from '../actions';
import { INFO_TOAST, SUCCESS_TOAST, DANGER_TOAST } from '../constants';

export default function toastsFromPyFlashMessages(flashMessages = []) {
  const toasts = [];

  flashMessages.forEach(([messageType, message]) => {
    const toastType =
      messageType === 'danger'
        ? DANGER_TOAST
        : (messageType === 'success' && SUCCESS_TOAST) || INFO_TOAST;

    const toast = addToast({
      text: message,
      toastType,
    }).payload;

    toasts.push(toast);
  });

  return toasts;
}
