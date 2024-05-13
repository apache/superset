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

/**
 * Get fresh color metadata
 *
 * @param colorScheme - the current color scheme
 * @returns Record<string, any>
 */
export const getFreshColorSchemeMetadata = (
  colorScheme: string,
  colorNamespace?: string,
): Record<string, any> => {
  const colorMetadata: Record<string, any> = {};

  colorMetadata.color_scheme = colorScheme;
  colorMetadata.color_namespace = colorNamespace || '';
  colorMetadata.shared_label_colors = getLabelsColorMapEntries();
  colorMetadata.color_scheme_domain =
    getCategoricalSchemeRegistry().get(colorScheme)?.colors || [];

  return colorMetadata;
};

/**
 * Compare the current labels color map with a fresh one
 *
 * @param currentLabelsColorMap - the current labels color map
 * @returns true if the labels color map is the same as fresh
 */
export const isLabelsColorMapSynced = (
  currentLabelsColorMap: Map<string, string>,
): boolean => {
  const freshLabelsColorMap = getLabelsColorMap().getColorMap();
  return Object.entries(freshLabelsColorMap).every(
    ([label, color]) =>
      currentLabelsColorMap.hasOwnProperty(label) &&
      currentLabelsColorMap[label] === color,
  );
};

/**
 * Merge labels colors with custom labels colors
 * Apply labels color based on chosen color scheme
 *
 * @param metadata - the dashboard metadata object
 */
export const applyLabelsColor = (metadata: Record<string, any>) => {
  const categoricalNamespace = CategoricalColorNamespace.getNamespace(
    metadata?.color_namespace,
  );
  const labelsColorMapInstance = getLabelsColorMap();
  const mergedLabelsColor = {
    ...(metadata?.label_colors || {}),
    ...(metadata?.shared_label_colors || {}),
  };
  // reset the labels color map based on the current color scheme
  categoricalNamespace.resetColors();
  labelsColorMapInstance.updateColorMap(
    categoricalNamespace,
    metadata.color_scheme,
  );

  Object.keys(mergedLabelsColor).forEach(label => {
    categoricalNamespace.setColor(label, mergedLabelsColor[label]);
  });
};

/**
 * Annihilate color maps
 *
 * @param color_namespace - the categorical namespace
 */
export const resetLabelsColor = (color_namespace?: string) => {
  const labelsColorMapInstance = getLabelsColorMap();
  const defaultCategoricalNamespace = color_namespace || '';
  const categoricalNamespace = CategoricalColorNamespace.getNamespace(
    defaultCategoricalNamespace,
  );
  categoricalNamespace.resetColors();
  labelsColorMapInstance.clear();
};
