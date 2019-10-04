import completeLegendConfig from '../../src/fillers/completeLegendConfig';

describe('completeLegendConfig()', () => {
  it('returns input legend config if legend is defined', () => {
    expect(
      completeLegendConfig('Color', {
        type: 'nominal',
        field: 'brand',
        legend: { a: 1 },
      }),
    ).toEqual({ a: 1 });
  });
  it('returns default legend config if legend is undefined', () => {
    expect(
      completeLegendConfig('X', {
        type: 'quantitative',
        field: 'consumption',
      }),
    ).toEqual(false);
  });
  it('returns default legend config if legend is undefined and channel is not X or Y', () => {
    expect(
      completeLegendConfig('Color', {
        type: 'nominal',
        field: 'brand',
      }),
    ).toEqual({});
  });
  it('returns false if legend is false', () => {
    expect(
      completeLegendConfig('Color', {
        type: 'nominal',
        field: 'brand',
        legend: false,
      }),
    ).toEqual(false);
  });
});
