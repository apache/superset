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

import tinycolor from 'tinycolor2';
import { CategoricalColorNamespace } from '.';
import makeSingleton from '../utils/makeSingleton';

export class SharedLabelColor {
  values: string[];

  valueSliceMap: Record<string, number[]>;

  constructor() {
    // save all shared label value
    this.values = [];
    // { value1: [sliceId1, sliceId2], value2: [sliceId], ...}
    this.valueSliceMap = {};
  }

  getColorMap(colorNamespace?: string, colorScheme?: string) {
    if (colorScheme) {
      const categoricalNamespace =
        CategoricalColorNamespace.getNamespace(colorNamespace);
      const scale = categoricalNamespace.getScale(colorScheme);
      const colors = scale.range();
      const multiple = Math.ceil(this.values.length / colors.length);
      const analogousColors = colors.map(color => {
        const result = tinycolor(color).analogous(Math.max(multiple, 5));
        return result.slice(result.length - multiple, result.length);
      });
      const generatedColors: tinycolor.Instance[] = [];
      // [[A, AA, AAA], [B, BB, BBB]] => [A, B, AA, BB, AAA, BBB]
      while (analogousColors[analogousColors.length - 1]?.length) {
        analogousColors.forEach(colors =>
          generatedColors.push(colors.shift() as tinycolor.Instance),
        );
      }
      return this.values.reduce(
        (res, name, index) => ({
          ...res,
          [name.toString()]: generatedColors[index]?.toHexString(),
        }),
        {},
      );
    }
    return undefined;
  }

  addSlice(value: string, sliceId?: number) {
    if (!sliceId) return;
    const sliceIds = this.valueSliceMap[value] ?? [];
    if (sliceIds.indexOf(sliceId) === -1) {
      sliceIds.push(sliceId);
    }
    this.valueSliceMap[value] = sliceIds;
    if (sliceIds.length > 1 && this.values.indexOf(value) === -1) {
      this.values.push(value);
    }
  }

  removeSlice(sliceId: number) {
    Object.keys(this.valueSliceMap).forEach(value => {
      const sliceIds = this.valueSliceMap[value];
      if (sliceIds.indexOf(sliceId) > -1) {
        sliceIds.splice(sliceIds.indexOf(sliceId), 1);
        if (sliceIds.length <= 1 && this.values.indexOf(value) > -1) {
          this.values.splice(this.values.indexOf(value), 1);
        }
      }
    });
  }

  clear() {
    this.values = [];
    this.valueSliceMap = {};
  }
}

const getInstance = makeSingleton(SharedLabelColor);

export default getInstance;
