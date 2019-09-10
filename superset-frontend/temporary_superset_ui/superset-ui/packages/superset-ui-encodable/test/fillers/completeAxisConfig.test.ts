import completeAxisConfig from '../../src/fillers/completeAxisConfig';

const DEFAULT_OUTPUT = {
  format: undefined,
  labelAngle: 0,
  labelFlush: true,
  labelOverlap: {
    labelAngle: 40,
    strategy: 'rotate',
  },
  labelPadding: 4,
  orient: 'bottom',
  tickCount: 5,
  ticks: true,
  titlePadding: 4,
};

describe('completeAxisConfig(channelDef)', () => {
  it('returns axis config with type', () => {
    expect(completeAxisConfig('X', { type: 'quantitative', field: 'consumption' })).toEqual(
      DEFAULT_OUTPUT,
    );
  });
  describe('default settings', () => {
    describe('format and title', () => {
      it('inherit from channel if not specified', () => {
        expect(
          completeAxisConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            format: '.2f',
            title: 'King in the North',
          }),
        ).toEqual({
          ...DEFAULT_OUTPUT,
          format: '.2f',
          title: 'King in the North',
        });
      });
      it('does not change if already specified', () => {
        expect(
          completeAxisConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            format: '.2f',
            title: 'King in the North',
            axis: { format: '.3f', title: 'Mother of Dragons' },
          }),
        ).toEqual({
          ...DEFAULT_OUTPUT,
          format: '.3f',
          title: 'Mother of Dragons',
        });
      });
    });
    describe('labelOverlap', () => {
      describe('expands strategy name to strategy object', () => {
        it('flat', () => {
          expect(
            completeAxisConfig('X', {
              type: 'quantitative',
              field: 'consumption',
              axis: { labelOverlap: 'flat' },
            }),
          ).toEqual({
            ...DEFAULT_OUTPUT,
            labelOverlap: {
              strategy: 'flat',
            },
          });
        });
        it('rotate', () => {
          expect(
            completeAxisConfig('X', {
              type: 'quantitative',
              field: 'consumption',
              axis: { labelOverlap: 'rotate' },
            }),
          ).toEqual({
            ...DEFAULT_OUTPUT,
            labelOverlap: {
              labelAngle: 40,
              strategy: 'rotate',
            },
          });
        });
        it('auto for X', () => {
          expect(
            completeAxisConfig('X', {
              type: 'quantitative',
              field: 'consumption',
              axis: { labelOverlap: 'auto' },
            }),
          ).toEqual({
            ...DEFAULT_OUTPUT,
            labelOverlap: {
              labelAngle: 40,
              strategy: 'rotate',
            },
          });
        });
        it('auto for Y', () => {
          expect(
            completeAxisConfig('Y', {
              type: 'quantitative',
              field: 'consumption',
              axis: { labelOverlap: 'auto' },
            }),
          ).toEqual({
            ...DEFAULT_OUTPUT,
            labelOverlap: {
              strategy: 'flat',
            },
            orient: 'left',
          });
        });
      });
      it('if given a strategy object, clone and return', () => {
        const strategy = { strategy: 'flat' as const };
        const output = completeAxisConfig('X', {
          type: 'quantitative',
          field: 'consumption',
          axis: { labelOverlap: strategy },
        });
        expect(output).toEqual({
          ...DEFAULT_OUTPUT,
          labelOverlap: strategy,
        });
        if (output !== false) {
          expect(output.labelOverlap).not.toBe(strategy);
        }
      });
    });
    describe('orient', () => {
      it('uses default for X', () => {
        expect(completeAxisConfig('X', { type: 'quantitative', field: 'consumption' })).toEqual(
          DEFAULT_OUTPUT,
        );
      });
      it('uses default for Y', () => {
        expect(completeAxisConfig('YBand', { type: 'quantitative', field: 'consumption' })).toEqual(
          {
            ...DEFAULT_OUTPUT,
            labelOverlap: {
              strategy: 'flat',
            },
            orient: 'left',
          },
        );
      });
      it('does not change if already specified', () => {
        expect(
          completeAxisConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            axis: { orient: 'top' },
          }),
        ).toEqual({
          ...DEFAULT_OUTPUT,
          orient: 'top',
        });
      });
    });
    describe('others', () => {
      it('does not change if already specified', () => {
        expect(
          completeAxisConfig('X', {
            type: 'quantitative',
            field: 'consumption',
            axis: {
              labelAngle: 30,
              labelFlush: false,
              labelPadding: 10,
              tickCount: 20,
              ticks: false,
              titlePadding: 10,
            },
          }),
        ).toEqual({
          ...DEFAULT_OUTPUT,
          labelAngle: 30,
          labelFlush: false,
          labelPadding: 10,
          tickCount: 20,
          ticks: false,
          titlePadding: 10,
        });
      });
    });
  });

  it('returns false if not XY channel', () => {
    expect(completeAxisConfig('Color', { type: 'quantitative', field: 'consumption' })).toEqual(
      false,
    );
  });
  it('returns false if axis is null', () => {
    expect(
      completeAxisConfig('X', { type: 'quantitative', field: 'consumption', axis: null }),
    ).toEqual(false);
  });
  it('returns false if axis is false', () => {
    expect(
      completeAxisConfig('X', {
        type: 'quantitative',
        field: 'consumption',
        axis: false,
      }),
    ).toEqual(false);
  });
});
