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
  sliceLabelColorMap: Map<number, Map<string, string | undefined>>;

  allColorMap: Map<string, string>;

  constructor() {
    // { sliceId1: { label1: color1 }, sliceId2: { label2: color2 } }
    this.sliceLabelColorMap = new Map();
    this.allColorMap = new Map();
  }

  updateColorMap(colorNamespace?: string, colorScheme?: string) {
    const categoricalNamespace =
      CategoricalColorNamespace.getNamespace(colorNamespace);
    const colorScale = categoricalNamespace.getScale(colorScheme);
    const newSliceLabelColorMap = new Map(this.sliceLabelColorMap);
    this.clear();
    newSliceLabelColorMap.forEach((colorMap, sliceId) => {
      const newColorMap = new Map();
      colorMap.forEach((_, label) => {
        const newColor = colorScale(label);
        newColorMap.set(label, newColor);
        this.allColorMap.set(label, newColor);
      });
      this.sliceLabelColorMap.set(sliceId, newColorMap);
    });
  }

  getColorMap() {
    return Object.fromEntries(this.allColorMap);
  }

  addSlice(label: string, color: string, sliceId?: number) {
    if (sliceId === undefined) return;
    let colorMap = this.sliceLabelColorMap.get(sliceId);
    if (!colorMap) {
      colorMap = new Map();
    }
    colorMap.set(label, color);
    this.sliceLabelColorMap.set(sliceId, colorMap);
    this.allColorMap.set(label, color);
  }

  removeSlice(sliceId: number) {
    const removeColorMap = this.sliceLabelColorMap.get(sliceId);
    if (removeColorMap) {
      removeColorMap.forEach((_, label) => {
        this.allColorMap.delete(label);
      });
    }
    this.sliceLabelColorMap.delete(sliceId);
  }

  clear() {
    this.sliceLabelColorMap.clear();
    this.allColorMap.clear();
  }
}

const getInstance = makeSingleton(SharedLabelColor);

export default getInstance;
