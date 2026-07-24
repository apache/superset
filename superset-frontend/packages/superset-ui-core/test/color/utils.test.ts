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
  hexToRgb,
  rgbToHex,
  rgbaToHex,
  forceHexAlpha,
} from '@superset-ui/core';

describe('color utils', () => {
  describe('getContrastingColor', () => {
    test('when called with 3-digit hex color', () => {
      const color = getContrastingColor('#000');
      expect(color).toBe('#FFF');
    });

    test('when called with 6-digit hex color', () => {
      const color = getContrastingColor('#000000');
      expect(color).toBe('#FFF');
    });

    test('when called with no # prefix hex color', () => {
      const color = getContrastingColor('000000');
      expect(color).toBe('#FFF');
    });

    test('when called with rgb color', () => {
      const color = getContrastingColor('rgb(0, 0, 0)');
      expect(color).toBe('#FFF');
    });

    test('when called with thresholds', () => {
      const color1 = getContrastingColor('rgb(255, 255, 255)');
      const color2 = getContrastingColor('rgb(255, 255, 255)', 255);
      expect(color1).toBe('#000');
      expect(color2).toBe('#FFF');
    });

    test('when called with rgba color, throw error', () => {
      expect(() => {
        getContrastingColor('rgba(0, 0, 0, 0.1)');
      }).toThrow();
    });

    test('when called with invalid color, throw error', () => {
      expect(() => {
        getContrastingColor('#0000');
      }).toThrow();
    });
  });
  describe('addAlpha', () => {
    test('adds 20% opacity to black', () => {
      expect(addAlpha('#000000', 0.2)).toBe('#00000033');
    });
    test('adds 50% opacity to white', () => {
      expect(addAlpha('#FFFFFF', 0.5)).toBe('#FFFFFF80');
    });
    test('should apply transparent alpha', () => {
      expect(addAlpha('#000000', 0)).toBe('#00000000');
    });
    test('should apply fully opaque', () => {
      expect(addAlpha('#000000', 1)).toBe('#000000FF');
    });
    test('opacity should be between 0 and 1', () => {
      expect(() => {
        addAlpha('#000000', 2);
      }).toThrow();
      expect(() => {
        addAlpha('#000000', -1);
      }).toThrow();
    });
  });
  describe('hexToRgb', () => {
    test('convert 3 digits hex', () => {
      expect(hexToRgb('#fff')).toBe('rgb(255, 255, 255)');
    });
    test('convert 6 digits hex', () => {
      expect(hexToRgb('#ffffff')).toBe('rgb(255, 255, 255)');
    });
    test('convert invalid hex', () => {
      expect(hexToRgb('#ffffffffffffff')).toBe('rgb(0, 0, 0)');
    });
  });
  describe('rgbToHex', () => {
    test('convert rgb to hex - white', () => {
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    });
    test('convert rgb to hex - black', () => {
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });
  });
  describe('rgbaToHex', () => {
    test('omits the alpha channel for opaque colors', () => {
      expect(rgbaToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
      expect(rgbaToHex({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000');
    });
    test('appends the alpha channel for translucent colors', () => {
      expect(rgbaToHex({ r: 0, g: 150, b: 0, a: 0.2 })).toBe('#00960033');
      expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
    });
    test('fully transparent colors keep an explicit 00 alpha', () => {
      expect(rgbaToHex({ r: 255, g: 255, b: 255, a: 0 })).toBe('#ffffff00');
    });
    test('zero-pads single-digit channels', () => {
      expect(rgbaToHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
    });
    test('rounds fractional channel values', () => {
      expect(rgbaToHex({ r: 254.6, g: 0.4, b: 0 })).toBe('#ff0000');
    });
  });
  describe('forceHexAlpha', () => {
    test('appends 60% alpha to a 6-digit hex string', () => {
      expect(forceHexAlpha('#ff0000')).toBe('#ff000099');
    });
    test('adds the # prefix when missing', () => {
      expect(forceHexAlpha('ff0000')).toBe('#ff000099');
    });
    test('replaces the existing alpha on an 8-digit hex string', () => {
      expect(forceHexAlpha('#ff000033')).toBe('#ff000099');
    });
    test('converts an RGBColor object using 60% alpha', () => {
      expect(forceHexAlpha({ r: 255, g: 0, b: 0 })).toBe('#ff000099');
    });
    test('overrides the alpha of a translucent RGBColor object', () => {
      expect(forceHexAlpha({ r: 0, g: 150, b: 0, a: 0.2 })).toBe('#00960099');
    });
  });
});
