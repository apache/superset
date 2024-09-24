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

import {
  CategoricalColorNamespace,
  getCategoricalSchemeRegistry,
  getLabelsColorMap,
} from '@superset-ui/core';

/**
 * Forces falsy namespace values to undefined to default to GLOBAL
 *
 * @param namespace
 * @returns - namespace or default undefined
 */
export const getColorNamespace = (namespace?: string) => namespace || undefined;

/**
 * Get the labels color map entries
 *
 * @returns Record<string, string>
 */
export const getLabelsColorMapEntries = (): Record<string, string> => {
  const labelsColorMapInstance = getLabelsColorMap();
  const updatedLabelsColorMapEntries = Object.fromEntries(
    labelsColorMapInstance.getColorMap(),
  );
  return updatedLabelsColorMapEntries;
};

export const getColorSchemeDomain = (colorScheme: string) =>
  getCategoricalSchemeRegistry().get(colorScheme)?.colors || [];

/**
 * Compare the current labels color map with a fresh one
 *
 * @param currentLabelsColorMap - the current labels color map
 * @returns true if the labels color map is the same as fresh
 */
export const isLabelsColorMapSynced = (
  metadata: Record<string, any>,
): boolean => {
  const currentLabelsColorMap = metadata?.shared_label_colors || {};
  const customLabelColors = metadata?.label_colors || {};
  const freshLabelsColorMap = getLabelsColorMap().getColorMap();
  const isSynced = Array.from(freshLabelsColorMap.entries()).every(
    ([label, color]) =>
      currentLabelsColorMap.hasOwnProperty(label) &&
      (currentLabelsColorMap[label] === color ||
        customLabelColors[label] !== undefined),
  );
  return isSynced;
};

/**
 * Annihilate color maps
 *
 * @param color_namespace - the categorical namespace
 */
export const resetColors = (color_namespace?: string) => {
  const labelsColorMapInstance = getLabelsColorMap();
  const categoricalNamespace = CategoricalColorNamespace.getNamespace(
    getColorNamespace(color_namespace),
  );
  categoricalNamespace.resetColors();
  labelsColorMapInstance.clear();
};

/**
 * Update the labels color map based on current color scheme
 * It will respect custom label colors if set via namespace
 *
 * @param namespace - the color namespace
 * @param colorScheme - the current color scheme
 */
export const refreshLabelsColorMap = (
  namespace?: string,
  colorScheme?: string,
) => {
  const colorNameSpace = getColorNamespace(namespace);
  const categoricalNamespace =
    CategoricalColorNamespace.getNamespace(colorNameSpace);
  const labelsColorMapInstance = getLabelsColorMap();

  labelsColorMapInstance.updateColorMap(categoricalNamespace, colorScheme);
};

/**
 * Merge labels colors with custom labels colors
 * Apply labels color based on chosen color scheme
 *
 * @param metadata - the dashboard metadata object
 */
export const applyColors = (metadata: Record<string, any>, fresh = false) => {
  const colorNameSpace = getColorNamespace(metadata?.color_namespace);
  const categoricalNamespace =
    CategoricalColorNamespace.getNamespace(colorNameSpace);
  const colorScheme = metadata?.color_scheme;
  const customLabelColors = metadata?.label_colors || {};
  // when scheme unset, update only custom label colors
  const labelsColorMap = metadata?.shared_label_colors || {};

  // reset forced colors (custom labels + labels color map)
  categoricalNamespace.resetColors();

  // apply custom label colors first
  Object.keys(customLabelColors).forEach(label => {
    categoricalNamespace.setColor(label, customLabelColors[label]);
  });

  // re-instantiate a fresh labels color map based on current scheme
  // will consider also just applied custom label colors
  refreshLabelsColorMap(metadata?.color_namespace, colorScheme);

  // get the fresh map that was just updated or existing
  const labelsColorMapEntries = fresh
    ? getLabelsColorMapEntries()
    : labelsColorMap;

  // apply the final color map
  Object.keys(labelsColorMapEntries).forEach(label => {
    categoricalNamespace.setColor(label, labelsColorMapEntries[label]);
  });
};
