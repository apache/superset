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

import { getContrastingColor } from '@superset-ui/core/src/color';

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
});
