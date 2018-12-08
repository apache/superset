import {
  DANGER_TOAST,
  INFO_TOAST,
  SUCCESS_TOAST,
} from '../../../../src/messageToasts/constants';

import getToastsFromPyFlashMessages from '../../../../src/messageToasts/utils/getToastsFromPyFlashMessages';

describe('getToastsFromPyFlashMessages', () => {
  it('should return an info toast', () => {
    const toast = getToastsFromPyFlashMessages([['info', 'info test']])[0];
    expect(toast).toMatchObject({ toastType: INFO_TOAST, text: 'info test' });
  });

  it('should return a success toast', () => {
    const toast = getToastsFromPyFlashMessages([
      ['success', 'success test'],
    ])[0];
    expect(toast).toMatchObject({
      toastType: SUCCESS_TOAST,
      text: 'success test',
    });
  });

  it('should return a danger toast', () => {
    const toast = getToastsFromPyFlashMessages([['danger', 'danger test']])[0];
    expect(toast).toMatchObject({
      toastType: DANGER_TOAST,
      text: 'danger test',
    });
  });
});
