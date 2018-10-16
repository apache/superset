import isRequired from '../../../src/utils/isRequired';

describe('isRequired(field)', () => {
  it('should throw error with the given field in the message', () => {
    expect(() => isRequired('myField')).toThrowError(Error);
  });
});
