'use strict';

var _color = require('./color');

var _color2 = _interopRequireDefault(_color);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('helpers/color', function () {
  describe('simpleCheckForValidColor', function () {
    test('throws on null', function () {
      var data = null;
      expect(function () {
        return _color2.default.simpleCheckForValidColor(data);
      }).toThrowError(TypeError);
    });

    test('throws on undefined', function () {
      var data = undefined;
      expect(function () {
        return _color2.default.simpleCheckForValidColor(data);
      }).toThrowError(TypeError);
    });

    test('no-op on number', function () {
      var data = 255;
      expect(_color2.default.simpleCheckForValidColor(data)).toEqual(data);
    });

    test('no-op on NaN', function () {
      var data = NaN;
      expect(isNaN(_color2.default.simpleCheckForValidColor(data))).toBeTruthy();
    });

    test('no-op on string', function () {
      var data = 'ffffff';
      expect(_color2.default.simpleCheckForValidColor(data)).toEqual(data);
    });

    test('no-op on array', function () {
      var data = [];
      expect(_color2.default.simpleCheckForValidColor(data)).toEqual(data);
    });

    test('no-op on rgb objects with numeric keys', function () {
      var data = { r: 0, g: 0, b: 0 };
      expect(_color2.default.simpleCheckForValidColor(data)).toEqual(data);
    });

    test('no-op on an object with an r g b a h s v key mapped to a NaN value', function () {
      var data = { r: NaN };
      expect(_color2.default.simpleCheckForValidColor(data)).toEqual(data);
    });

    test('no-op on hsl "s" percentage', function () {
      var data = { s: '15%' };
      expect(_color2.default.simpleCheckForValidColor(data)).toEqual(data);
    });

    test('no-op on hsl "l" percentage', function () {
      var data = { l: '100%' };
      expect(_color2.default.simpleCheckForValidColor(data)).toEqual(data);
    });

    test('should return false for invalid percentage', function () {
      var data = { l: '100%2' };
      expect(_color2.default.simpleCheckForValidColor(data)).toBe(false);
    });
  });

  describe('toState', function () {
    test('returns an object giving a color in all formats', function () {
      expect(_color2.default.toState('red')).toEqual({
        hsl: { a: 1, h: 0, l: 0.5, s: 1 },
        hex: '#ff0000',
        rgb: { r: 255, g: 0, b: 0, a: 1 },
        hsv: { h: 0, s: 1, v: 1, a: 1 },
        oldHue: 0,
        source: undefined
      });
    });

    test('gives hex color with leading hash', function () {
      expect(_color2.default.toState('blue').hex).toEqual('#0000ff');
    });

    test('doesn\'t mutate hsl color object', function () {
      var originalData = { h: 0, s: 0, l: 0, a: 1 };
      var data = Object.assign({}, originalData);
      _color2.default.toState(data);
      expect(data).toEqual(originalData);
    });

    test('doesn\'t mutate hsv color object', function () {
      var originalData = { h: 0, s: 0, v: 0, a: 1 };
      var data = Object.assign({}, originalData);
      _color2.default.toState(data);
      expect(data).toEqual(originalData);
    });
  });

  describe('isValidHex', function () {
    test('allows strings of length 3 or 6', function () {
      expect(_color2.default.isValidHex('f')).toBeFalsy();
      expect(_color2.default.isValidHex('ff')).toBeFalsy();
      expect(_color2.default.isValidHex('fff')).toBeTruthy();
      expect(_color2.default.isValidHex('ffff')).toBeFalsy();
      expect(_color2.default.isValidHex('fffff')).toBeFalsy();
      expect(_color2.default.isValidHex('ffffff')).toBeTruthy();
      expect(_color2.default.isValidHex('fffffff')).toBeFalsy();
      expect(_color2.default.isValidHex('ffffffff')).toBeFalsy();
      expect(_color2.default.isValidHex('fffffffff')).toBeFalsy();
      expect(_color2.default.isValidHex('ffffffffff')).toBeFalsy();
      expect(_color2.default.isValidHex('fffffffffff')).toBeFalsy();
      expect(_color2.default.isValidHex('ffffffffffff')).toBeFalsy();
    });

    test('allows strings without leading hash', function () {
      // Check a sample of possible colors - doing all takes too long.
      for (var i = 0; i <= 0xffffff; i += 0x010101) {
        var hex = ('000000' + i.toString(16)).slice(-6);
        expect(_color2.default.isValidHex(hex)).toBeTruthy();
      }
    });

    test('allows strings with leading hash', function () {
      // Check a sample of possible colors - doing all takes too long.
      for (var i = 0; i <= 0xffffff; i += 0x010101) {
        var hex = ('000000' + i.toString(16)).slice(-6);
        expect(_color2.default.isValidHex('#' + hex)).toBeTruthy();
      }
    });

    test('is case-insensitive', function () {
      expect(_color2.default.isValidHex('ffffff')).toBeTruthy();
      expect(_color2.default.isValidHex('FfFffF')).toBeTruthy();
      expect(_color2.default.isValidHex('FFFFFF')).toBeTruthy();
    });

    test('does not allow non-hex characters', function () {
      expect(_color2.default.isValidHex('gggggg')).toBeFalsy();
    });

    test('does not allow numbers', function () {
      expect(_color2.default.isValidHex(0xffffff)).toBeFalsy();
    });
  });

  describe('getContrastingColor', function () {
    test('returns a light color for a giving dark color', function () {
      expect(_color2.default.getContrastingColor('red')).toEqual('#fff');
    });

    test('returns a dark color for a giving light color', function () {
      expect(_color2.default.getContrastingColor('white')).toEqual('#000');
    });

    test('returns a predefined color for Transparent', function () {
      expect(_color2.default.getContrastingColor('transparent')).toEqual('rgba(0,0,0,0.4)');
    });

    test('returns a light color as default for undefined', function () {
      expect(_color2.default.getContrastingColor(undefined)).toEqual('#fff');
    });
  });
}); /* global test, expect, describe */