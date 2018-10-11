import isRequired from '../../../src/utils/isRequired';

describe('isRequired(field)', () => {
  test('should throw error with the given field in the message', () => {
    expect(() => isRequired('myField')).toThrowError(Error);
  });
});
