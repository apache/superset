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
  ensureIsArray,
  getCategoricalSchemeRegistry,
  getLabelsColorMap,
} from '@superset-ui/core';
import { intersection, omit, pick } from 'lodash';
import { areObjectsEqual } from 'src/reduxUtils';

const EMPTY_ARRAY: string[] = [];

/**
 * Force falsy namespace values to undefined to default to GLOBAL
 *
 * @param namespace
 * @returns - namespace or default undefined
 */
export const getColorNamespace = (namespace?: string) => namespace || undefined;

/**
 *
 * Field shared_label_colors used to be a dict of all colors for all labels.
 * Force shared_label_colors field to be a list of actual shared labels.
 *
 * @param sharedLabelsColors - the shared label colors list
 * @returns string[]
 */
export const enforceSharedLabelsColorsArray = (
  sharedLabelsColors: string[] | Record<string, string> | undefined,
) => (Array.isArray(sharedLabelsColors) ? sharedLabelsColors : EMPTY_ARRAY);

/**
 * Get labels shared across all charts in a dashboard.
 * Merges a fresh instance of shared label colors with a stored one.
 *
 * @param currentSharedLabels - existing shared labels to merge with fresh
 * @returns Record<string, string>
 */
export const getFreshSharedLabels = (
  currentSharedLabels: string[] = [],
): string[] => {
  const { chartsLabelsMap } = getLabelsColorMap();
  const allLabels = Array.from(chartsLabelsMap.values()).flatMap(
    ({ labels }) => labels,
  );

  const duplicates = Array.from(
    allLabels.reduce(
      (counts, label) => counts.set(label, (counts.get(label) || 0) + 1),
      new Map(),
    ),
  )
    .filter(([, count]) => count > 1)
    .map(([label]) => label);

  return Array.from(
    new Set([...ensureIsArray(currentSharedLabels), ...duplicates]),
  );
};

export const getSharedLabelsColorMapEntries = (
  currentColorMap: Record<string, string>,
  sharedLabels: string[],
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(currentColorMap).filter(([label]) =>
      sharedLabels.includes(label),
    ),
  );

/**
 * Returns all entries (labels and colors) except custom label colors.
 *
 * @param customLabelsColor - the custom label colors in label_colors field
 * @returns all color entries except custom label colors
 */
export const getFreshLabelsColorMapEntries = (
  customLabelsColor: Record<string, string> = {},
): Record<string, string> => {
  const labelsColorMapInstance = getLabelsColorMap();
  const allEntries = Object.fromEntries(labelsColorMapInstance.getColorMap());

  // custom label colors are applied and stored separetely via label_colors
  Object.keys(customLabelsColor).forEach(label => {
    delete allEntries[label];
  });

  return allEntries;
};

/**
 * Returns all dynamic labels and colors (excluding custom label colors).
 *
 * @param labelsColorMap - the labels color map
 * @param customLabelsColor - the custom label colors in label_colors field
 * @returns all color entries except custom label colors
 */
export const getDynamicLabelsColors = (
  fullLabelsColors: Record<string, string>,
  customLabelsColor: Record<string, string> = {},
): Record<string, string> =>
  omit(fullLabelsColors, Object.keys(customLabelsColor));

export const getColorSchemeDomain = (colorScheme: string) =>
  getCategoricalSchemeRegistry().get(colorScheme)?.colors || [];

/**
 * Compare the current labels color map with a fresh one
 *
 * @param currentLabelsColorMap - the current labels color map
 * @returns true if the labels color map is the same as fresh
 */
export const isLabelsColorMapSynced = (
  storedLabelsColors: Record<string, any>,
  freshLabelsColors: Record<string, any>,
  customLabelColors: Record<string, string>,
): boolean => {
  const freshLabelsCount = Object.keys(freshLabelsColors).length;

  // still updating, pass
  if (!freshLabelsCount) return true;

  const commonKeys = intersection(
    Object.keys(storedLabelsColors),
    Object.keys(freshLabelsColors),
  );

  const comparableStoredLabelsColors = pick(storedLabelsColors, commonKeys);
  const comparableFreshLabelsColors = pick(freshLabelsColors, commonKeys);

  const isSynced = areObjectsEqual(
    comparableStoredLabelsColors,
    comparableFreshLabelsColors,
    {
      ignoreFields: Object.keys(customLabelColors),
    },
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
  labelsColorMapInstance.reset();
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
  merge = false,
) => {
  const colorNameSpace = getColorNamespace(namespace);
  const categoricalNamespace =
    CategoricalColorNamespace.getNamespace(colorNameSpace);
  const labelsColorMapInstance = getLabelsColorMap();

  labelsColorMapInstance.updateColorMap(
    categoricalNamespace,
    colorScheme,
    merge,
  );
};

/**
 * Merge labels colors with custom labels colors
 * Apply labels color based on chosen color scheme
 *
 * @param metadata - the dashboard metadata object
 */
export const applyColors = (
  metadata: Record<string, any>,
  // Create a fresh color map by changing color scheme
  fresh: boolean | string[] = false,
  // Catch new labels in the color map as they appear
  merge = false,
  // Apply only label colors that are shared across multiple charts.
  shared = false,
) => {
  const colorNameSpace = getColorNamespace(metadata?.color_namespace);
  const categoricalNamespace =
    CategoricalColorNamespace.getNamespace(colorNameSpace);
  const colorScheme = metadata?.color_scheme;
  const fullLabelsColor = metadata?.map_label_colors || {};
  const sharedLabels = enforceSharedLabelsColorsArray(
    metadata?.shared_label_colors,
  );
  const customLabelsColor = metadata?.label_colors || {};
  const sharedLabelsColor = getSharedLabelsColorMapEntries(
    fullLabelsColor,
    sharedLabels,
  );

  if (fresh && !Array.isArray(fresh)) {
    // reset custom label colors
    // re-evaluate all other label colors
    categoricalNamespace.resetColors();
  }

  if (fresh && Array.isArray(fresh)) {
    // when a color scheme is not set for the dashboard
    // should only reset colors for charts that have changed scheme
    // while keeping colors of existing shared label colors intact
    // this is used also to reset custom label colors when added or removed
    categoricalNamespace.resetColorsForLabels(fresh);
  }

  if (fresh || merge) {
    // re-instantiate a fresh labels color map based on current scheme
    // it consider just applied custom label colors if present and all forced colors
    // it will merge with the existing color map new labels only when merge is true
    refreshLabelsColorMap(metadata?.color_namespace, colorScheme, merge);
  }

  let applicableColorMapEntries: Record<string, any> = fullLabelsColor;
  if (fresh) {
    // requires a new map all together
    applicableColorMapEntries = {
      ...getFreshLabelsColorMapEntries(customLabelsColor),
    };
  }
  if (merge) {
    // must only add up newly appearing labels
    // without overriding existing ones
    applicableColorMapEntries = {
      ...fullLabelsColor,
      ...getFreshLabelsColorMapEntries(customLabelsColor),
    };
  }

  if (shared) {
    // must apply the colors to only shared labels
    applicableColorMapEntries = sharedLabelsColor;
  }

  applicableColorMapEntries = {
    ...applicableColorMapEntries,
    ...customLabelsColor,
  };

  // apply the final color map
  if (applicableColorMapEntries) {
    Object.keys(applicableColorMapEntries).forEach(label => {
      categoricalNamespace.setColor(label, applicableColorMapEntries[label]);
    });
  }
};
