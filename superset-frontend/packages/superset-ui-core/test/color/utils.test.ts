/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  getContrastingColor,
  addAlpha,
  isValidHexColor,
  splitRgbAlpha,
  toRgbaHex,
} from '@superset-ui/core';

describe('color utils', () => {
  describe('getContrastingColor', () => {
    it('when called with 3-digit hex color', () => {
      const color = getContrastingColor('#000');
      expect(color).toBe('#FFF');
    });

    it('when called with 6-digit hex color', () => {
      const color = getContrastingColor('#000000');
      expect(color).toBe('#FFF');
    });

    it('when called with no # prefix hex color', () => {
      const color = getContrastingColor('000000');
      expect(color).toBe('#FFF');
    });

    it('when called with rgb color', () => {
      const color = getContrastingColor('rgb(0, 0, 0)');
      expect(color).toBe('#FFF');
    });

    it('when called with thresholds', () => {
      const color1 = getContrastingColor('rgb(255, 255, 255)');
      const color2 = getContrastingColor('rgb(255, 255, 255)', 255);
      expect(color1).toBe('#000');
      expect(color2).toBe('#FFF');
    });

    it('when called with rgba color, throw error', () => {
      expect(() => {
        getContrastingColor('rgba(0, 0, 0, 0.1)');
      }).toThrow();
    });

    it('when called with invalid color, throw error', () => {
      expect(() => {
        getContrastingColor('#0000');
      }).toThrow();
    });
  });
  describe('addAlpha', () => {
    it('adds 20% opacity to black', () => {
      expect(addAlpha('#000000', 0.2)).toBe('#00000033');
    });
    it('adds 50% opacity to white', () => {
      expect(addAlpha('#FFFFFF', 0.5)).toBe('#FFFFFF80');
    });
    it('should apply transparent alpha', () => {
      expect(addAlpha('#000000', 0)).toBe('#00000000');
    });
    it('should apply fully opaque', () => {
      expect(addAlpha('#000000', 1)).toBe('#000000FF');
    });
    it('opacity should be between 0 and 1', () => {
      expect(() => {
        addAlpha('#000000', 2);
      }).toThrow();
      expect(() => {
        addAlpha('#000000', -1);
      }).toThrow();
    });
  });
  describe('isValidHexColor', () => {
    it('6-digit with leading hash', () => {
      expect(isValidHexColor('#000000')).toBe(true);
    });
    it('8-digit with leading hash', () => {
      expect(isValidHexColor('#000000FF')).toBe(true);
    });
    it('3-digit with leading hash', () => {
      expect(isValidHexColor('#000')).toBe(true);
    });
    it('4-digit with leading hash', () => {
      expect(isValidHexColor('#0000')).toBe(true);
    });
    it('6-digit without leading hash', () => {
      expect(isValidHexColor('000000')).toBe(true);
    });
    it('8-digit without leading hash', () => {
      expect(isValidHexColor('000000FF')).toBe(true);
    });
    it('3-digit without leading hash', () => {
      expect(isValidHexColor('000')).toBe(true);
    });
    it('4-digit without leading hash', () => {
      expect(isValidHexColor('0000')).toBe(true);
    });
    it('bad string', () => {
      expect(isValidHexColor('foobar')).toBe(false);
    });
    it('undefined', () => {
      expect(isValidHexColor(undefined)).toBe(false);
    });
  });
  describe('toRgbaHex', () => {
    it('6-digit with leading hash', () => {
      expect(toRgbaHex('#000000')).toBe('#000000');
    });
    it('8-digit with leading hash', () => {
      expect(toRgbaHex('#000000FF')).toBe('#000000FF');
    });
    it('3-digit with leading hash', () => {
      expect(toRgbaHex('#000')).toBe('#000');
    });
    it('4-digit with leading hash', () => {
      expect(toRgbaHex('#0000')).toBe('#0000');
    });
    it('6-digit without leading hash', () => {
      expect(toRgbaHex('000000')).toBe('000000');
    });
    it('8-digit without leading hash', () => {
      expect(toRgbaHex('000000FF')).toBe('000000FF');
    });
    it('3-digit without leading hash', () => {
      expect(toRgbaHex('000')).toBe('000');
    });
    it('4-digit without leading hash', () => {
      expect(toRgbaHex('0000')).toBe('0000');
    });
    it('RGB object', () => {
      expect(toRgbaHex({ r: 255, g: 255, b: 0 })).toBe('#FFFF00FF');
    });
    it('RGBA object', () => {
      expect(toRgbaHex({ r: 255, g: 255, b: 0, a: 0.5 })).toBe('#FFFF0080');
    });
    it('bad string', () => {
      expect(toRgbaHex('foobar')).toBe('#000000FF');
    });
    it('undefined', () => {
      expect(toRgbaHex(undefined)).toBe('#000000FF');
    });
  });
  describe('splitRgbAlpha', () => {
    it('6-digit with leading hash', () => {
      expect(splitRgbAlpha('#000000')).toEqual({
        rgb: '#000000',
        alpha: undefined,
      });
    });
    it('8-digit with leading hash', () => {
      expect(splitRgbAlpha('#000000FF')).toEqual({
        rgb: '#000000',
        alpha: 1,
      });
    });
    it('3-digit with leading hash', () => {
      expect(splitRgbAlpha('#000')).toEqual({
        rgb: '#000',
        alpha: undefined,
      });
    });
    it('4-digit with leading hash', () => {
      expect(splitRgbAlpha('#0000')).toEqual({
        rgb: '#000',
        alpha: 0,
      });
    });
    it('6-digit without leading hash', () => {
      expect(splitRgbAlpha('000000')).toEqual({
        rgb: '000000',
        alpha: undefined,
      });
    });
    it('8-digit without leading hash', () => {
      expect(splitRgbAlpha('000000FF')).toEqual({
        rgb: '000000',
        alpha: 1,
      });
    });
    it('3-digit without leading hash', () => {
      expect(splitRgbAlpha('000')).toEqual({
        rgb: '000',
        alpha: undefined,
      });
    });
    it('4-digit without leading hash', () => {
      expect(splitRgbAlpha('0000')).toEqual({
        rgb: '000',
        alpha: 0,
      });
    });
    it('color should be a valid color string', () => {
      expect(splitRgbAlpha('foobar')).toBe(undefined);
      expect(splitRgbAlpha('#fubar')).toBe(undefined);
      expect(splitRgbAlpha(undefined)).toBe(undefined);
    });
  });
});
