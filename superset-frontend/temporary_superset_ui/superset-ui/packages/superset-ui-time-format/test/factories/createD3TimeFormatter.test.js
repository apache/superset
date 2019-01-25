import createD3TimeFormatter from '../../src/factories/createD3TimeFormatter';

describe('createD3TimeFormatter(config)', () => {
  it('requires config.formatString', () => {
    expect(() => createD3TimeFormatter()).toThrow();
    expect(() => createD3TimeFormatter({})).toThrow();
  });
});
