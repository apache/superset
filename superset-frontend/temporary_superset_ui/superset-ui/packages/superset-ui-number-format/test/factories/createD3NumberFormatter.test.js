import createD3NumberFormatter from '../../src/factories/createD3NumberFormatter';

describe('createD3NumberFormatter(config)', () => {
  it('requires config.formatString', () => {
    expect(() => createD3NumberFormatter({})).toThrow();
  });
});
