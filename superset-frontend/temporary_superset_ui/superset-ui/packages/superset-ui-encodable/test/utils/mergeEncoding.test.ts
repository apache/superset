import mergeEncoding from '../../src/utils/mergeEncoding';

describe('mergeEncoding()', () => {
  it('combines two encoding together', () => {
    expect(
      mergeEncoding<{
        size: ['Numeric', number];
      }>({ size: { value: 1 } }, {}),
    ).toEqual({
      size: { value: 1 },
    });
  });
});
