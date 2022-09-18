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

import { CategoricalColorNamespace } from '.';
import { makeSingleton } from '../utils';

export class SharedLabelColor {
  sliceLabelColorMap: Record<number, Record<string, string | undefined>>;

  constructor() {
    // { sliceId1: { label1: color1 }, sliceId2: { label2: color2 } }
    this.sliceLabelColorMap = {};
  }

  updateColorMap(colorNamespace?: string, colorScheme?: string) {
    const categoricalNamespace =
      CategoricalColorNamespace.getNamespace(colorNamespace);
    const colorScale = categoricalNamespace.getScale(colorScheme);
    const newSliceLabelColorMap = {};
    Object.keys(this.sliceLabelColorMap).forEach(sliceId => {
      Object.keys(this.sliceLabelColorMap[sliceId]).forEach(label => {
        newSliceLabelColorMap[sliceId] = {
          ...newSliceLabelColorMap[sliceId],
          [label]: colorScale(label),
        };
      });
    });
    this.sliceLabelColorMap = newSliceLabelColorMap;
  }

  getColorMap() {
    return Object.keys(this.sliceLabelColorMap).reduce(
      (res, sliceId) => ({
        ...res,
        ...Object.keys(this.sliceLabelColorMap[sliceId]).reduce(
          (res, label) => ({
            ...res,
            [label]: this.sliceLabelColorMap[sliceId][label],
          }),
          {},
        ),
      }),
      {} as Record<string, string>,
    );
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
}

const getInstance = makeSingleton(SharedLabelColor);

export default getInstance;
