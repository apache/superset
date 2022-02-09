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
          colors: ['red', 'green', 'blue'],
        }),
      );
  });

  beforeEach(() => {
    getSharedLabelColor().clear();
  });

  it('has default value out-of-the-box', () => {
    expect(getSharedLabelColor()).toBeInstanceOf(SharedLabelColor);
  });

  describe('.addSlice(value, sliceId)', () => {
    it('should add to valueSliceMap when first adding label', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 1);
      expect(sharedLabelColor.valueSliceMap).toHaveProperty('a', [1]);
      expect(sharedLabelColor.values).toHaveLength(0);
    });

    it('should not add to value when adding same sliceId', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 1);
      sharedLabelColor.addSlice('a', 1);
      expect(sharedLabelColor.valueSliceMap).toHaveProperty('a', [1]);
      expect(sharedLabelColor.values).toHaveLength(0);
    });

    it('should add to value when adding same label', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 1);
      sharedLabelColor.addSlice('a', 2);
      expect(sharedLabelColor.valueSliceMap).toHaveProperty('a', [1, 2]);
      expect(sharedLabelColor.values).toHaveLength(1);
    });

    it('do nothing when sliceId is undefined', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a');
      expect(sharedLabelColor.valueSliceMap).toEqual({});
      expect(sharedLabelColor.values).toHaveLength(0);
    });
  });

  describe('.remove(sliceId)', () => {
    it('should remove sliceId', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 1);
      sharedLabelColor.removeSlice(1);
      expect(sharedLabelColor.valueSliceMap).toHaveProperty('a', []);
    });

    it('should not remove sliceId when do not have sliceId', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 1);
      sharedLabelColor.removeSlice(2);
      expect(sharedLabelColor.valueSliceMap).toHaveProperty('a', [1]);
    });

    it('should remove label if less than two sliceIds', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 1);
      sharedLabelColor.addSlice('a', 2);
      sharedLabelColor.removeSlice(2);
      expect(sharedLabelColor.valueSliceMap).toHaveProperty('a', [1]);
      expect(sharedLabelColor.values).toHaveLength(0);
    });
  });

  describe('.getColorMap(namespace, scheme)', () => {
    it('return undefined when scheme is undefined', () => {
      const sharedLabelColor = getSharedLabelColor();
      const colorMap = sharedLabelColor.getColorMap();
      expect(colorMap).toBeUndefined();
    });

    it('return colorMap when scheme is defined', () => {
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.addSlice('a', 1);
      sharedLabelColor.addSlice('a', 2);
      const colorMap = sharedLabelColor.getColorMap('', 'testColors');
      expect(colorMap).toHaveProperty('a', 'blue');
    });
  });
});
