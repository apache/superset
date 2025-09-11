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

import { makeSingleton } from '../utils';
import CategoricalColorNamespace from './CategoricalColorNamespace';

export enum LabelsColorMapSource {
  Dashboard,
  Explore,
}

export class LabelsColorMap {
  chartsLabelsMap: Map<
    number,
    { labels: string[]; scheme?: string; ownScheme?: string }
  >;

  colorMap: Map<string, string>;

  source: LabelsColorMapSource;

  constructor() {
    // holds labels and original color schemes for each chart in context
    this.chartsLabelsMap = new Map();
    this.colorMap = new Map();
    this.source = LabelsColorMapSource.Dashboard;
  }

  /**
   * Wipes out the color map and updates it with the new color scheme.
   *
   * @param categoricalNamespace - the namespace to use for color mapping
   * @param colorScheme - color scheme
   */
  updateColorMap(
    categoricalNamespace: CategoricalColorNamespace,
    colorScheme?: string,
    merge = false,
  ) {
    const newColorMap = this.colorMap;

    if (!merge) {
      newColorMap.clear();
    }

    this.chartsLabelsMap.forEach((chartConfig, sliceId) => {
      const { labels, ownScheme } = chartConfig;
      const appliedColorScheme = colorScheme || ownScheme;
      const colorScale = categoricalNamespace.getScale(appliedColorScheme);

      labels.forEach(label => {
        // if merge, apply the scheme only to new labels in the map
        if (!merge || !this.colorMap.has(label)) {
          const newColor = colorScale.getColor(
            label,
            sliceId,
            appliedColorScheme,
          );
          newColorMap.set(label, newColor);
        }
      });
    });
    this.colorMap = newColorMap;
  }

  getColorMap() {
    return this.colorMap;
  }

  /**
   *
   * Called individually by each plugin via getColor fn.
   *
   * @param label - the label name
   * @param color - the color
   * @param sliceId - the chart id
   * @param colorScheme - the color scheme
   *
   */
  addSlice(
    label: string,
    color: string,
    sliceId: number,
    colorScheme?: string,
  ) {
    const chartConfig = this.chartsLabelsMap.get(sliceId) || {
      labels: [],
      scheme: undefined,
      ownScheme: undefined,
    };

    const { labels } = chartConfig;
    if (!labels.includes(label)) {
      labels.push(label);
      this.chartsLabelsMap.set(sliceId, {
        labels,
        scheme: colorScheme,
        ownScheme: chartConfig.ownScheme,
      });
    }
    if (this.source === LabelsColorMapSource.Dashboard) {
      this.colorMap.set(label, color);
    }
  }

  /**
   * Used to make sure all slices respect their original scheme.
   *
   * @param sliceId - the chart id
   * @param ownScheme - the color scheme
   */
  setOwnColorScheme(sliceId: number, ownScheme: string) {
    const chartConfig = this.chartsLabelsMap.get(sliceId);
    if (chartConfig) {
      this.chartsLabelsMap.set(sliceId, {
        ...chartConfig,
        ownScheme,
      });
    }
  }

  /**
   * Remove a slice from the color map.
   *
   * @param sliceId - the chart
   */
  removeSlice(sliceId: number) {
    if (this.source !== LabelsColorMapSource.Dashboard) return;

    this.chartsLabelsMap.delete(sliceId);
    const newColorMap = new Map();

    this.chartsLabelsMap.forEach(chartConfig => {
      const { labels } = chartConfig;
      labels.forEach(label => {
        newColorMap.set(label, this.colorMap.get(label));
      });
    });
    this.colorMap = newColorMap;
  }

  /**
   * Clear the shared labels color map.
   */
  clear() {
    this.colorMap.clear();
  }

  /**
   * Clears all maps
   */
  reset() {
    this.clear();
    this.chartsLabelsMap.clear();
  }
}

const getInstance = makeSingleton(LabelsColorMap);

export default getInstance;
