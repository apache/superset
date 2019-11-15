import {
  getSequentialSchemeRegistry,
  SequentialScheme,
  getCategoricalSchemeRegistry,
  CategoricalScheme,
} from '@superset-ui/color';
import { ScaleLinear, ScaleTime } from 'd3-scale';
import createScaleFromScaleConfig from '../../../src/parsers/scale/createScaleFromScaleConfig';

describe('createScaleFromScaleConfig(config)', () => {
  describe('default', () => {
    it('returns linear scale', () => {
      // @ts-ignore
      const scale = createScaleFromScaleConfig({});
      expect(scale(1)).toEqual(1);
    });
  });

  describe('linear scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 10],
        range: [0, 100],
      });
      expect(scale(10)).toEqual(100);
    });
    it('with reverse domain', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 10],
        range: [0, 100],
        reverse: true,
      });
      expect(scale(10)).toEqual(0);
    });
    describe('does not set domain if domain has undefined or null', () => {
      describe('undefined', () => {
        it('min', () => {
          const scale = createScaleFromScaleConfig({
            type: 'linear',
            domain: [undefined, 30],
            range: [0, 100],
          });
          expect(scale(10)).toEqual(1000);
        });
        it('max', () => {
          const scale = createScaleFromScaleConfig({
            type: 'linear',
            domain: [0, undefined],
            range: [0, 100],
          });
          expect(scale(10)).toEqual(1000);
        });
        it('both', () => {
          const scale = createScaleFromScaleConfig({
            type: 'linear',
            domain: [undefined, undefined],
            range: [0, 100],
          });
          expect(scale(10)).toEqual(1000);
        });
      });
      describe('null', () => {
        it('min', () => {
          const scale = createScaleFromScaleConfig({
            type: 'linear',
            domain: [null, 30],
            range: [0, 100],
          });
          expect(scale(10)).toEqual(1000);
        });
        it('max', () => {
          const scale = createScaleFromScaleConfig({
            type: 'linear',
            domain: [0, null],
            range: [0, 100],
          });
          expect(scale(10)).toEqual(1000);
        });
        it('both', () => {
          const scale = createScaleFromScaleConfig({
            type: 'linear',
            domain: [null, null],
            range: [0, 100],
          });
          expect(scale(10)).toEqual(1000);
        });
      });
    });
    it('with color scheme as range', () => {
      getSequentialSchemeRegistry().registerValue(
        'test-scheme',
        new SequentialScheme({
          id: 'test-scheme',
          colors: ['#ff0000', '#ffff00'],
        }),
      );

      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 10],
        scheme: 'test-scheme',
      });

      expect(scale(0)).toEqual('rgb(255, 0, 0)');
      expect(scale(10)).toEqual('rgb(255, 255, 0)');

      getSequentialSchemeRegistry().remove('test-scheme');
    });
    it('with color scheme as range, but no color scheme available', () => {
      getSequentialSchemeRegistry().clearDefaultKey();

      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 10],
        scheme: 'test-scheme',
      });

      expect(scale(0)).toEqual(0);
      expect(scale(10)).toEqual(1);
    });
    it('with nice', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 9.9],
        range: [0, 100],
        nice: true,
      });
      expect(scale(10)).toEqual(100);
    });
    it('with nice=false', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 9.9],
        range: [0, 100],
        nice: false,
      });
      expect(Number(scale(10)).toFixed(2)).toEqual('101.01');
    });
    it('with nice is number', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 9.9],
        range: [0, 100],
        nice: 3,
      });
      expect((scale as ScaleLinear<number, number>).ticks(3)).toEqual([0, 5, 10]);
    });
    it('with clamp', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 10],
        range: [0, 100],
        clamp: true,
      });
      expect(scale(-10000)).toEqual(0);
      expect(scale(10000)).toEqual(100);
    });
    it('with round', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [0, 10],
        range: [0, 10],
        round: true,
      });
      expect(scale(9.9)).toEqual(10);
    });
    it('with zero', () => {
      const scale = createScaleFromScaleConfig({
        type: 'linear',
        domain: [2, 10],
        range: [0, 10],
        zero: true,
      });
      expect(scale(5)).toEqual(5);
    });
    it('with interpolate', () => {
      expect(() =>
        createScaleFromScaleConfig({
          type: 'linear',
          interpolate: 'cubehelix',
        }),
      ).toThrowError('"scale.interpolate" is not supported yet.');
    });
  });

  describe('log scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'log',
        domain: [1, 100],
        range: [1, 10],
      });
      expect(scale(10)).toEqual(5.5);
      expect(scale(100)).toEqual(10);
    });
    it('with base', () => {
      const scale = createScaleFromScaleConfig({
        type: 'log',
        domain: [1, 16],
        base: 2,
      });
      expect(scale(8)).toEqual(0.75);
    });
  });

  describe('power scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'pow',
        domain: [0, 100],
      });
      expect(scale(10)).toEqual(0.1);
      expect(scale(100)).toEqual(1);
    });
    it('with exponent', () => {
      const scale = createScaleFromScaleConfig({
        type: 'pow',
        exponent: 2,
      });
      expect(scale(3)).toEqual(9);
      expect(scale(4)).toEqual(16);
    });
  });

  describe('sqrt scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'sqrt',
      });
      expect(scale(4)).toEqual(2);
      expect(scale(9)).toEqual(3);
    });
  });

  describe('symlog scale', () => {
    it('is not supported yet', () => {
      expect(() => createScaleFromScaleConfig({ type: 'symlog' })).toThrowError(
        '"scale.type = symlog" is not supported yet.',
      );
    });
  });

  describe('time scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'time',
        domain: [
          {
            year: 2019,
            month: 7,
            date: 1,
          },
          {
            year: 2019,
            month: 7,
            date: 31,
          },
        ],
        range: [0, 100],
      });
      expect(scale(new Date(2019, 6, 1))).toEqual(0);
      expect(scale(new Date(2019, 6, 16))).toEqual(50);
      expect(scale(new Date(2019, 6, 31))).toEqual(100);
    });
    it('with nice is string', () => {
      const scale = createScaleFromScaleConfig({
        type: 'time',
        domain: [
          {
            year: 2019,
            month: 7,
            date: 5,
          },
          {
            year: 2019,
            month: 7,
            date: 30,
          },
        ],
        range: [0, 100],
        nice: 'month',
      });
      expect((scale as ScaleTime<number, number>).domain()).toEqual([
        new Date(2019, 6, 1),
        new Date(2019, 7, 1),
      ]);
    });
    it('with nice is interval object', () => {
      const scale = createScaleFromScaleConfig({
        type: 'time',
        domain: [
          {
            year: 2019,
            month: 7,
            date: 5,
          },
          {
            year: 2019,
            month: 7,
            date: 30,
          },
        ],
        range: [0, 100],
        nice: { interval: 'month', step: 2 },
      });
      expect((scale as ScaleTime<number, number>).domain()).toEqual([
        new Date(2019, 6, 1),
        new Date(2019, 8, 1),
      ]);
    });
  });

  describe('UTC scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'utc',
        domain: [
          {
            year: 2019,
            month: 7,
            date: 1,
            utc: true,
          },
          {
            year: 2019,
            month: 7,
            date: 31,
            utc: true,
          },
        ],
        range: [0, 100],
      });
      expect(scale(new Date(Date.UTC(2019, 6, 1)))).toEqual(0);
      expect(scale(new Date(Date.UTC(2019, 6, 16)))).toEqual(50);
      expect(scale(new Date(Date.UTC(2019, 6, 31)))).toEqual(100);
    });
    it('with nice is string', () => {
      const scale = createScaleFromScaleConfig({
        type: 'utc',
        domain: [
          {
            year: 2019,
            month: 7,
            date: 5,
            utc: true,
          },
          {
            year: 2019,
            month: 7,
            date: 30,
            utc: true,
          },
        ],
        range: [0, 100],
        nice: 'month',
      });
      expect((scale as ScaleTime<number, number>).domain()).toEqual([
        new Date(Date.UTC(2019, 6, 1)),
        new Date(Date.UTC(2019, 7, 1)),
      ]);
    });
    it('with nice is interval object', () => {
      const scale = createScaleFromScaleConfig({
        type: 'utc',
        domain: [
          {
            year: 2019,
            month: 7,
            date: 5,
            utc: true,
          },
          {
            year: 2019,
            month: 7,
            date: 30,
            utc: true,
          },
        ],
        range: [0, 100],
        nice: { interval: 'month', step: 2 },
      });
      expect((scale as ScaleTime<number, number>).domain()).toEqual([
        new Date(Date.UTC(2019, 6, 1)),
        new Date(Date.UTC(2019, 8, 1)),
      ]);
    });
    it('with nice is interval object that has invalid step', () => {
      const scale = createScaleFromScaleConfig({
        type: 'utc',
        domain: [
          {
            year: 2019,
            month: 7,
            date: 5,
            utc: true,
          },
          {
            year: 2019,
            month: 7,
            date: 30,
            utc: true,
          },
        ],
        range: [0, 100],
        nice: { interval: 'month', step: 0.5 },
      });
      expect((scale as ScaleTime<number, number>).domain()).toEqual([
        new Date(Date.UTC(2019, 6, 5)),
        new Date(Date.UTC(2019, 6, 30)),
      ]);
    });
  });

  describe('quantile scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'quantile',
        domain: [0, 100],
        range: [0, 1, 2, 3],
      });
      expect(scale(0)).toEqual(0);
      expect(scale(10)).toEqual(0);
      expect(scale(25)).toEqual(1);
      expect(scale(50)).toEqual(2);
      expect(scale(75)).toEqual(3);
      expect(scale(100)).toEqual(3);
    });
  });

  describe('quantize scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'quantize',
        domain: [10, 100],
        range: [1, 2, 4],
      });
      expect(scale(20)).toEqual(1);
      expect(scale(50)).toEqual(2);
      expect(scale(80)).toEqual(4);
    });
    it('with string range', () => {
      const scale = createScaleFromScaleConfig({
        type: 'quantize',
        domain: [0, 1],
        range: ['calm-brown', 'shocking-pink'],
      });
      expect(scale(0.49)).toEqual('calm-brown');
      expect(scale(0.51)).toEqual('shocking-pink');
    });
  });

  describe('threshold scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'threshold',
        domain: [0, 1],
        range: ['red', 'white', 'green'],
      });
      expect(scale(-1)).toEqual('red');
      expect(scale(0)).toEqual('white');
      expect(scale(0.5)).toEqual('white');
      expect(scale(1)).toEqual('green');
      expect(scale(1000)).toEqual('green');
    });
  });

  describe('ordinal scale', () => {
    beforeEach(() => {
      getCategoricalSchemeRegistry()
        .registerValue(
          'test-scheme',
          new CategoricalScheme({
            id: 'test-scheme',
            colors: ['red', 'white', 'green'],
          }),
        )
        .registerValue(
          'test-scheme2',
          new CategoricalScheme({
            id: 'test-scheme',
            colors: ['pink', 'charcoal', 'orange'],
          }),
        )
        .setDefaultKey('test-scheme');
    });

    afterEach(() => {
      getCategoricalSchemeRegistry()
        .remove('test-scheme')
        .remove('test-scheme2')
        .clearDefaultKey();
    });

    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'ordinal',
      });
      expect(scale('fish')).toEqual('red');
      expect(scale('dinosaur')).toEqual('white');
      expect(scale('whale')).toEqual('green');
    });
    it('with range', () => {
      const scale = createScaleFromScaleConfig({
        type: 'ordinal',
        domain: ['fish', 'dinosaur'],
        range: ['red', 'white', 'green'],
      });
      expect(scale('fish')).toEqual('red');
      expect(scale('dinosaur')).toEqual('white');
      expect(scale('whale')).toEqual('green');
    });
    it('with color scheme', () => {
      const scale = createScaleFromScaleConfig({
        type: 'ordinal',
        scheme: 'test-scheme',
      });
      expect(scale('fish')).toEqual('red');
      expect(scale('dinosaur')).toEqual('white');
      expect(scale('whale')).toEqual('green');
    });
    it('with color scheme and domain', () => {
      const scale = createScaleFromScaleConfig({
        type: 'ordinal',
        domain: ['fish', 'dinosaur'],
        scheme: 'test-scheme2',
      });
      expect(scale('fish')).toEqual('pink');
      expect(scale('dinosaur')).toEqual('charcoal');
      expect(scale('whale')).toEqual('pink');
    });
    it('with color scheme and reversed domain', () => {
      const scale = createScaleFromScaleConfig({
        type: 'ordinal',
        domain: ['pig', 'panda'],
        reverse: true,
        scheme: 'test-scheme2',
      });
      expect(scale('pig')).toEqual('charcoal');
      expect(scale('panda')).toEqual('pink');
    });
    it('with namespace', () => {
      const scale1 = createScaleFromScaleConfig({
        type: 'ordinal',
        namespace: 'abc',
      });
      const scale2 = createScaleFromScaleConfig({
        type: 'ordinal',
        namespace: 'def',
      });
      const scale3 = createScaleFromScaleConfig({
        type: 'ordinal',
        namespace: 'def',
      });

      expect(scale1('fish')).toEqual('red');
      expect(scale1('dinosaur')).toEqual('white');
      expect(scale1('whale')).toEqual('green');

      expect(scale2('whale')).toEqual('red');
      expect(scale2('dinosaur')).toEqual('white');
      expect(scale2('fish')).toEqual('green');

      expect(scale3('fish')).toEqual('green');
      expect(scale3('dinosaur')).toEqual('white');
      expect(scale3('whale')).toEqual('red');
    });
  });

  describe('bin-ordinal scale', () => {
    it('is not supported yet', () => {
      expect(() => createScaleFromScaleConfig({ type: 'bin-ordinal' })).toThrowError(
        '"scale.type = bin-ordinal" is not supported yet.',
      );
    });
  });

  describe('point scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'point',
        domain: ['fish', 'dinosaur', 'whale'],
        range: [0, 100],
      });
      expect(scale('fish')).toEqual(0);
      expect(scale('dinosaur')).toEqual(50);
      expect(scale('whale')).toEqual(100);
    });
    it('with padding', () => {
      const scale = createScaleFromScaleConfig({
        type: 'point',
        domain: ['fish', 'dinosaur', 'whale'],
        range: [0, 100],
        padding: 1,
      });
      expect(scale('fish')).toEqual(25);
      expect(scale('dinosaur')).toEqual(50);
      expect(scale('whale')).toEqual(75);
    });
    it('with round', () => {
      const scale = createScaleFromScaleConfig({
        type: 'point',
        domain: ['fish', 'dinosaur', 'whale'],
        range: [0, 100],
        padding: 0.5,
        round: true,
      });
      expect(scale('fish')).toEqual(17);
      expect(scale('dinosaur')).toEqual(50);
      expect(scale('whale')).toEqual(83);
    });
  });

  describe('band scale', () => {
    it('basic', () => {
      const scale = createScaleFromScaleConfig({
        type: 'band',
        domain: ['fish', 'dinosaur'],
        range: [0, 100],
      });
      expect(scale('fish')).toEqual(0);
      expect(scale('dinosaur')).toEqual(50);
    });
    it('with paddingInner', () => {
      const scale = createScaleFromScaleConfig<number>({
        type: 'band',
        domain: ['fish', 'dinosaur', 'whale'],
        range: [0, 100],
        paddingInner: 0.5,
      });
      expect(scale('fish')).toEqual(0);
      expect(scale('dinosaur')).toEqual(40);
      expect(scale('whale')).toEqual(80);
    });
    it('with paddingOuter', () => {
      const scale = createScaleFromScaleConfig<number>({
        type: 'band',
        domain: ['fish', 'dinosaur', 'whale'],
        range: [0, 100],
        paddingOuter: 0.5,
      });
      expect(scale('fish')).toEqual(12.5);
      expect(scale('dinosaur')).toEqual(37.5);
      expect(scale('whale')).toEqual(62.5);
    });
    it('with align', () => {
      const scale = createScaleFromScaleConfig<number>({
        type: 'band',
        domain: ['fish', 'dinosaur', 'whale'],
        range: [0, 100],
        align: 0,
        paddingOuter: 0.5,
      });
      expect(scale('fish')).toEqual(0);
      expect(scale('dinosaur')).toEqual(25);
      expect(scale('whale')).toEqual(50);
    });
  });
});
