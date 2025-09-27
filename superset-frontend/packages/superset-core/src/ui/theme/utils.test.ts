/**
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
import { theme as antdThemeImport } from 'antd';
import {
  isSerializableConfig,
  deserializeThemeConfig,
  serializeThemeConfig,
  normalizeThemeConfig,
  getAntdConfig,
  getSystemColors,
} from './utils';
import {
  type AnyThemeConfig,
  type SerializableThemeConfig,
  type AntdThemeConfig,
  ThemeAlgorithm,
} from './types';

describe('Theme utilities', () => {
  describe('isSerializableConfig', () => {
    it('returns true when algorithm is undefined', () => {
      const config: AnyThemeConfig = {
        token: { colorPrimary: '#ff0000' },
      };

      expect(isSerializableConfig(config)).toBe(true);
    });

    it('returns true when algorithm is a string', () => {
      const config: AnyThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: ThemeAlgorithm.DARK,
      };

      expect(isSerializableConfig(config)).toBe(true);
    });

    it('returns true when algorithm is an array of strings', () => {
      const config: AnyThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: [ThemeAlgorithm.DARK, ThemeAlgorithm.COMPACT],
      };

      expect(isSerializableConfig(config)).toBe(true);
    });

    it('returns false when algorithm is a function', () => {
      const config: AnyThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: antdThemeImport.darkAlgorithm,
      };

      expect(isSerializableConfig(config)).toBe(false);
    });

    it('returns false when algorithm is an array containing a function', () => {
      const config: AnyThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: [
          antdThemeImport.darkAlgorithm,
          antdThemeImport.compactAlgorithm,
        ],
      };

      expect(isSerializableConfig(config)).toBe(false);
    });
  });

  describe('deserializeThemeConfig', () => {
    it('converts string algorithm to function reference', () => {
      const config: SerializableThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: ThemeAlgorithm.DARK,
      };

      const result = deserializeThemeConfig(config);

      expect(result.algorithm).toBe(antdThemeImport.darkAlgorithm);
    });

    it('converts array of string algorithms to function references', () => {
      const config: SerializableThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: [ThemeAlgorithm.DARK, ThemeAlgorithm.COMPACT],
      };

      const result = deserializeThemeConfig(config);

      expect(Array.isArray(result.algorithm)).toBe(true);
      expect(result.algorithm).toContain(antdThemeImport.darkAlgorithm);
      expect(result.algorithm).toContain(antdThemeImport.compactAlgorithm);
    });

    it('preserves other configuration properties', () => {
      const config: SerializableThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: ThemeAlgorithm.DARK,
        hashed: true,
      };

      const result = deserializeThemeConfig(config);

      expect(result.token).toEqual({ colorPrimary: '#ff0000' });
      expect(result.hashed).toBe(true);
    });

    it('handles undefined algorithm', () => {
      const config: SerializableThemeConfig = {
        token: { colorPrimary: '#ff0000' },
      };

      const result = deserializeThemeConfig(config);

      expect(result.algorithm).toBe(antdThemeImport.defaultAlgorithm);
    });

    it('converts default algorithm string to function reference', () => {
      const config: SerializableThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: ThemeAlgorithm.DEFAULT,
      };

      const result = deserializeThemeConfig(config);

      expect(result.algorithm).toBe(antdThemeImport.defaultAlgorithm);
    });

    it('converts compact algorithm string to function reference', () => {
      const config: SerializableThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: ThemeAlgorithm.COMPACT,
      };

      const result = deserializeThemeConfig(config);

      expect(result.algorithm).toBe(antdThemeImport.compactAlgorithm);
    });
  });

  describe('serializeThemeConfig', () => {
    it('converts function algorithm to string', () => {
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: antdThemeImport.darkAlgorithm,
      };

      const result = serializeThemeConfig(config);

      expect(result.algorithm).toBe(ThemeAlgorithm.DARK);
    });

    it('converts array of function algorithms to strings', () => {
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: [
          antdThemeImport.darkAlgorithm,
          antdThemeImport.compactAlgorithm,
        ],
      };

      const result = serializeThemeConfig(config);

      expect(Array.isArray(result.algorithm)).toBe(true);
      expect(result.algorithm).toContain(ThemeAlgorithm.DARK);
      expect(result.algorithm).toContain(ThemeAlgorithm.COMPACT);
    });

    it('preserves other configuration properties', () => {
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: antdThemeImport.darkAlgorithm,
        hashed: true,
      };

      const result = serializeThemeConfig(config);

      expect(result.token).toEqual({ colorPrimary: '#ff0000' });
      expect(result.hashed).toBe(true);
    });

    it('handles undefined algorithm', () => {
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
      };

      const result = serializeThemeConfig(config);

      expect(result.algorithm).toBeUndefined();
    });

    it('defaults to "default" for unknown algorithms', () => {
      const unknownAlgorithm = () => ({});
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        // @ts-ignore
        algorithm: unknownAlgorithm,
      };

      const result = serializeThemeConfig(config);

      expect(result.algorithm).toBe(ThemeAlgorithm.DEFAULT);
    });

    it('converts default algorithm function to string', () => {
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: antdThemeImport.defaultAlgorithm,
      };

      const result = serializeThemeConfig(config);

      expect(result.algorithm).toBe(ThemeAlgorithm.DEFAULT);
    });

    it('converts compact algorithm function to string', () => {
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: antdThemeImport.compactAlgorithm,
      };

      const result = serializeThemeConfig(config);

      expect(result.algorithm).toBe(ThemeAlgorithm.COMPACT);
    });

    it('defaults each unknown algorithm in array to "default"', () => {
      const unknownAlgorithm = () => ({});
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        // @ts-ignore
        algorithm: [antdThemeImport.darkAlgorithm, unknownAlgorithm],
      };

      const result = serializeThemeConfig(config);

      expect(Array.isArray(result.algorithm)).toBe(true);
      expect(result.algorithm).toEqual([
        ThemeAlgorithm.DARK,
        ThemeAlgorithm.DEFAULT,
      ]);
    });

    it('handles mixed known and unknown algorithms in array', () => {
      const unknownAlgorithm1 = () => ({});
      const unknownAlgorithm2 = () => ({});
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: [
          antdThemeImport.darkAlgorithm,
          // @ts-ignore
          unknownAlgorithm1,
          antdThemeImport.compactAlgorithm,
          // @ts-ignore
          unknownAlgorithm2,
        ],
      };

      const result = serializeThemeConfig(config);

      expect(Array.isArray(result.algorithm)).toBe(true);
      expect(result.algorithm).toEqual([
        ThemeAlgorithm.DARK,
        ThemeAlgorithm.DEFAULT,
        ThemeAlgorithm.COMPACT,
        ThemeAlgorithm.DEFAULT,
      ]);
    });
  });

  describe('normalizeThemeConfig', () => {
    it('returns the same config for non-serializable configs', () => {
      const config: AntdThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: antdThemeImport.darkAlgorithm,
      };

      const result = normalizeThemeConfig(config);

      expect(result).toBe(config);
    });

    it('deserializes serializable configs', () => {
      const config: SerializableThemeConfig = {
        token: { colorPrimary: '#ff0000' },
        algorithm: ThemeAlgorithm.DARK,
      };

      const result = normalizeThemeConfig(config);

      expect(result.algorithm).toBe(antdThemeImport.darkAlgorithm);
    });
  });

  describe('getAntdConfig', () => {
    it('returns config with default algorithm for light mode', () => {
      const seed = { colorPrimary: '#ff0000' };

      const result = getAntdConfig(seed, false);

      expect(result.token).toBe(seed);
      expect(result.algorithm).toBe(antdThemeImport.defaultAlgorithm);
    });

    it('returns config with dark algorithm for dark mode', () => {
      const seed = { colorPrimary: '#ff0000' };

      const result = getAntdConfig(seed, true);

      expect(result.token).toBe(seed);
      expect(result.algorithm).toBe(antdThemeImport.darkAlgorithm);
    });
  });

  describe('getSystemColors', () => {
    it('extracts system colors from tokens', () => {
      const tokens = {
        colorPrimary: '#primary',
        colorError: '#error',
        colorWarning: '#warning',
        colorSuccess: '#success',
        colorInfo: '#info',
        otherToken: 'ignore-me',
      };

      const result = getSystemColors(tokens);

      expect(result).toEqual({
        colorPrimary: '#primary',
        colorError: '#error',
        colorWarning: '#warning',
        colorSuccess: '#success',
        colorInfo: '#info',
      });
    });
  });
});
