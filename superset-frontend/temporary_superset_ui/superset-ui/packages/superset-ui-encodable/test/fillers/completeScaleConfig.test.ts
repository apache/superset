import completeScaleConfig from '../../src/fillers/completeScaleConfig';

describe('completeScaleConfig(channelDef)', () => {
  it('returns scale config with type', () => {
    expect(completeScaleConfig('X', { type: 'quantitative', field: 'consumption' })).toEqual({
      type: 'linear',
      nice: true,
      clamp: true,
      zero: true,
    });
  });
  describe('default settings', () => {
    describe('nice', () => {
      it('set if not specified', () => {
        expect(completeScaleConfig('X', { type: 'quantitative', field: 'consumption' })).toEqual({
          type: 'linear',
          nice: true,
          clamp: true,
          zero: true,
        });
      });
      it('does not apply if incompatible', () => {
        expect(
          completeScaleConfig('Category', {
            type: 'nominal',
            field: 'brand',
            scale: { type: 'point' },
          }),
        ).toEqual({
          type: 'point',
        });
      });
      it('does not change if already specified', () => {
        expect(
          completeScaleConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            scale: { nice: false },
          }),
        ).toEqual({
          type: 'linear',
          nice: false,
          clamp: true,
          zero: true,
        });
      });
    });
    describe('clamp', () => {
      it('set if not specified', () => {
        expect(completeScaleConfig('X', { type: 'quantitative', field: 'consumption' })).toEqual({
          type: 'linear',
          nice: true,
          clamp: true,
          zero: true,
        });
      });
      it('does not change if already specified', () => {
        expect(
          completeScaleConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            scale: { clamp: false },
          }),
        ).toEqual({
          type: 'linear',
          nice: true,
          clamp: false,
          zero: true,
        });
      });
    });
    describe('zero', () => {
      it('set if not specified', () => {
        expect(completeScaleConfig('X', { type: 'quantitative', field: 'consumption' })).toEqual({
          type: 'linear',
          nice: true,
          clamp: true,
          zero: true,
        });
      });
      it('does not apply if incompatible', () => {
        expect(
          completeScaleConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            scale: { type: 'log' },
          }),
        ).toEqual({
          type: 'log',
          nice: true,
          clamp: true,
        });
      });
      it('does not change if already specified', () => {
        expect(
          completeScaleConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            scale: { zero: false },
          }),
        ).toEqual({
          type: 'linear',
          nice: true,
          clamp: true,
          zero: false,
        });
      });
    });
  });

  it('returns false if scale is null', () => {
    expect(
      completeScaleConfig('X', { type: 'quantitative', field: 'consumption', scale: null }),
    ).toEqual(false);
  });
  it('returns false if cannot infer scale type', () => {
    expect(completeScaleConfig('X', { type: 'geojson', field: 'lat' })).toEqual(false);
  });
});
