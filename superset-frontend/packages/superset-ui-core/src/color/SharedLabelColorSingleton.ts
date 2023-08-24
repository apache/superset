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

export enum SharedLabelColorSource {
  dashboard,
  explore,
}
export class SharedLabelColor {
  sliceLabelMap: Map<number, string[]>;

  colorMap: Map<string, string>;

  source: SharedLabelColorSource;

  constructor() {
    // { sliceId1: [label1, label2, ...], sliceId2: [label1, label2, ...] }
    this.sliceLabelMap = new Map();
    this.colorMap = new Map();
    this.source = SharedLabelColorSource.dashboard;
  }

  updateColorMap(colorNamespace?: string, colorScheme?: string) {
    const categoricalNamespace =
      CategoricalColorNamespace.getNamespace(colorNamespace);
    const newColorMap = new Map();
    this.colorMap.clear();
    this.sliceLabelMap.forEach(labels => {
      const colorScale = categoricalNamespace.getScale(colorScheme);
      labels.forEach(label => {
        const newColor = colorScale(label);
        newColorMap.set(label, newColor);
      });
    });
    this.colorMap = newColorMap;
  }

  getColorMap() {
    return this.colorMap;
  }

  addSlice(label: string, color: string, sliceId?: number) {
    if (
      this.source !== SharedLabelColorSource.dashboard ||
      sliceId === undefined
    )
      return;
    const labels = this.sliceLabelMap.get(sliceId) || [];
    if (!labels.includes(label)) {
      labels.push(label);
      this.sliceLabelMap.set(sliceId, labels);
    }
    this.colorMap.set(label, color);
  }

  removeSlice(sliceId: number) {
    if (this.source !== SharedLabelColorSource.dashboard) return;
    this.sliceLabelMap.delete(sliceId);
    const newColorMap = new Map();
    this.sliceLabelMap.forEach(labels => {
      labels.forEach(label => {
        newColorMap.set(label, this.colorMap.get(label));
      });
    });
    this.colorMap = newColorMap;
  }

  reset() {
    const copyColorMap = new Map(this.colorMap);
    copyColorMap.forEach((_, label) => {
      this.colorMap.set(label, '');
    });
  }

  clear() {
    this.sliceLabelMap.clear();
    this.colorMap.clear();
  }
}

const getInstance = makeSingleton(SharedLabelColor);

export default getInstance;
