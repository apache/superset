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
  sliceLabelColorMap: Record<number, Record<string, string | undefined>>;

  constructor() {
    // { sliceId1: { label1: color1 }, sliceId2: { label2: color2 } }
    this.sliceLabelColorMap = {};
  }

  getColorMap(
    colorNamespace?: string,
    colorScheme?: string,
    updateColorScheme?: boolean,
  ) {
    if (colorScheme) {
      const categoricalNamespace =
        CategoricalColorNamespace.getNamespace(colorNamespace);
      const colors = categoricalNamespace.getScale(colorScheme).range();
      const sharedLabels = this.getSharedLabels();
      const generatedColors: tinycolor.Instance[] = [];
      let sharedLabelMap;

      if (sharedLabels.length) {
        const multiple = Math.ceil(sharedLabels.length / colors.length);
        const ext = 5;
        const analogousColors = colors.map(color => {
          const result = tinycolor(color).analogous(multiple + ext);
          return result.slice(ext);
        });

        // [[A, AA, AAA], [B, BB, BBB]] => [A, B, AA, BB, AAA, BBB]
        while (analogousColors[analogousColors.length - 1]?.length) {
          analogousColors.forEach(colors =>
            generatedColors.push(colors.shift() as tinycolor.Instance),
          );
        }
        sharedLabelMap = sharedLabels.reduce(
          (res, label, index) => ({
            ...res,
            [label.toString()]: generatedColors[index]?.toHexString(),
          }),
          {},
        );
      }

      const labelMap = Object.keys(this.sliceLabelColorMap).reduce(
        (res, sliceId) => {
          const colorScale = categoricalNamespace.getScale(colorScheme);
          return {
            ...res,
            ...Object.keys(this.sliceLabelColorMap[sliceId]).reduce(
              (res, label) => ({
                ...res,
                [label]: updateColorScheme
                  ? colorScale(label)
                  : this.sliceLabelColorMap[sliceId][label],
              }),
              {},
            ),
          };
        },
        {},
      );

      return {
        ...labelMap,
        ...sharedLabelMap,
      };
    }
    return undefined;
  }

  addSlice(label: string, color: string, sliceId?: number) {
    if (!sliceId) return;
    this.sliceLabelColorMap[sliceId] = {
      ...this.sliceLabelColorMap[sliceId],
      [label]: color,
    };
  }

  removeSlice(sliceId: number) {
    delete this.sliceLabelColorMap[sliceId];
  }

  clear() {
    this.sliceLabelColorMap = {};
  }

  getSharedLabels() {
    const tempLabels = new Set<string>();
    const result = new Set<string>();
    Object.keys(this.sliceLabelColorMap).forEach(sliceId => {
      const colorMap = this.sliceLabelColorMap[sliceId];
      Object.keys(colorMap).forEach(label => {
        if (tempLabels.has(label) && !result.has(label)) {
          result.add(label);
        } else {
          tempLabels.add(label);
        }
      });
    });
    return [...result];
  }
}

const getInstance = makeSingleton(SharedLabelColor);

export default getInstance;
