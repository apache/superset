import getClientErrorObject from '../../../src/utils/getClientErrorObject';

describe('getClientErrorObject()', () => {
  it('Returns a Promise', () => {
    const response = getClientErrorObject('error');
    expect(response.constructor === Promise).toBe(true);
  });

  it('Returns a Promise that resolves to an object with an error key', () => {
    const error = 'error';

    return getClientErrorObject(error).then((errorObj) => {
      expect(errorObj).toMatchObject({ error });
    });
  });

  it('Handles Response that can be parsed as json', () => {
    const jsonError = { something: 'something', error: 'Error message' };
    const jsonErrorString = JSON.stringify(jsonError);

    return getClientErrorObject(new Response(jsonErrorString)).then((errorObj) => {
      expect(errorObj).toMatchObject(jsonError);
    });
  });

  it('Handles Response that can be parsed as text', () => {
    const textError = 'Hello I am a text error';

    return getClientErrorObject(new Response(textError)).then((errorObj) => {
      expect(errorObj).toMatchObject({ error: textError });
    });
  });

  it('Handles plain text as input', () => {
    const error = 'error';

    return getClientErrorObject(error).then((errorObj) => {
      expect(errorObj).toMatchObject({ error });
    });
  });
});
