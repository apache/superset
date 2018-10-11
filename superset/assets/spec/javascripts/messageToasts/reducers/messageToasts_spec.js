import { ADD_TOAST, REMOVE_TOAST } from '../../../../src/messageToasts/actions';
import messageToastsReducer from '../../../../src/messageToasts/reducers';

describe('messageToasts reducer', () => {
  test('should return initial state', () => {
    expect(messageToastsReducer(undefined, {})).toEqual([]);
  });

  test('should add a toast', () => {
    expect(
      messageToastsReducer([], {
        type: ADD_TOAST,
        payload: { text: 'test', id: 'id', type: 'test_type' },
      }),
    ).toEqual([{ text: 'test', id: 'id', type: 'test_type' }]);
  });

  test('should add a toast', () => {
    expect(
      messageToastsReducer([{ id: 'id' }, { id: 'id2' }], {
        type: REMOVE_TOAST,
        payload: { id: 'id' },
      }),
    ).toEqual([{ id: 'id2' }]);
  });
});
