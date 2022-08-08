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
  CategoricalScheme,
  getCategoricalSchemeRegistry,
  getSharedLabelColor,
  SharedLabelColor,
} from '@superset-ui/core';

describe('SharedLabelColor', () => {
  beforeAll(() => {
    getCategoricalSchemeRegistry()
      .registerValue(
        'testColors',
        new CategoricalScheme({
          id: 'testColors',
          colors: ['red', 'green', 'blue'],
        }),
      )
      .registerValue(
        'testColors2',
        new CategoricalScheme({
          id: 'testColors2',
          colors: ['yellow', 'green', 'blue'],
        }),
      );
  });

  beforeEach(() => {
    getSharedLabelColor().clear();
  });

  it('has default value out-of-the-box', () => {
    expect(getSharedLabelColor()).toBeInstanceOf(SharedLabelColor);
  });

  describe('.addSlice(value, color, sliceId)', () => {
    it('should add to valueSliceMap when first adding label', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 'red', 1);
      expect(sharedLabelColor.sliceLabelColorMap).toHaveProperty('1', {
        a: 'red',
      });
    });

    it('do nothing when sliceId is undefined', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 'red');
      expect(sharedLabelColor.sliceLabelColorMap).toEqual({});
    });
  });

  describe('.remove(sliceId)', () => {
    it('should remove sliceId', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 'red', 1);
      sharedLabelColor.removeSlice(1);
      expect(sharedLabelColor.sliceLabelColorMap).toEqual({});
    });
  });

  describe('.getColorMap(namespace, scheme, updateColorScheme)', () => {
    it('return undefined when scheme is undefined', () => {
      const sharedLabelColor = getSharedLabelColor();
      const colorMap = sharedLabelColor.getColorMap();
      expect(colorMap).toBeUndefined();
    });

    it('return undefined value if pass updateColorScheme', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 'red', 1);
      sharedLabelColor.addSlice('b', 'blue', 2);
      const colorMap = sharedLabelColor.getColorMap('', 'testColors2', true);
      expect(colorMap).toEqual({ a: 'yellow', b: 'yellow' });
    });

    it('return color value if not pass updateColorScheme', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 'red', 1);
      sharedLabelColor.addSlice('b', 'blue', 2);
      const colorMap = sharedLabelColor.getColorMap('', 'testColors');
      expect(colorMap).toEqual({ a: 'red', b: 'blue' });
    });

    it('return color value if shared label exit', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 'red', 1);
      sharedLabelColor.addSlice('a', 'blue', 2);
      const colorMap = sharedLabelColor.getColorMap('', 'testColors');
      expect(colorMap).not.toEqual({});
    });
  });
});
