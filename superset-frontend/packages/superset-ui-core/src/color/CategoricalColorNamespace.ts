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

import { cloneDeep } from 'lodash';
import CategoricalColorScale from './CategoricalColorScale';
import { ColorsLookup } from './types';
import getCategoricalSchemeRegistry from './CategoricalSchemeRegistrySingleton';
import stringifyAndTrim from './stringifyAndTrim';

export default class CategoricalColorNamespace {
  name: string;

  forcedItems: ColorsLookup;

  scales: {
    [key: string]: CategoricalColorScale;
  };

  constructor(name: string) {
    this.name = name;
    this.scales = {};
    this.forcedItems = {};
  }

  /**
   * A new CategoricalColorScale instance is created for each chart.
   *
   * @param colorScheme - the color scheme to use
   * @returns a new instance of a color scale
   */
  getScale(colorScheme?: string) {
    const id =
      colorScheme ?? getCategoricalSchemeRegistry().getDefaultKey() ?? '';
    const scheme = getCategoricalSchemeRegistry().get(id);
    return new CategoricalColorScale(
      scheme?.colors ?? [],
      this.forcedItems,
      colorScheme,
    );
  }

  /**
   * Enforce specific color for given value
   * This will apply across all color scales
   * in this namespace.
   * @param {*} value value
   * @param {*} forcedColor color
   */
  setColor(value: string, forcedColor: string) {
    this.forcedItems[stringifyAndTrim(value)] = forcedColor;

    return this;
  }

  resetColors() {
    this.forcedItems = {};
  }

  resetColorsForLabels(labels: string[] = []) {
    const updatedForcedItems = cloneDeep(this.forcedItems);
    labels.forEach(label => {
      if (updatedForcedItems.hasOwnProperty(label)) {
        delete updatedForcedItems[label];
      }
    });

    this.forcedItems = { ...updatedForcedItems };
  }
}

const namespaces: {
  [key: string]: CategoricalColorNamespace;
} = {};

export const DEFAULT_NAMESPACE = 'GLOBAL';

export function getNamespace(name: string = DEFAULT_NAMESPACE) {
  const instance = namespaces[name];
  if (instance) {
    return instance;
  }
  const newInstance = new CategoricalColorNamespace(name);
  namespaces[name] = newInstance;

  return newInstance;
}

export function getColor(
  value?: string,
  colorScheme?: string,
  namespace?: string,
) {
  return getNamespace(namespace).getScale(colorScheme).getColor(value);
}

/*
  Returns a new scale instance within the same namespace.
  Especially useful when a chart is booting for the first time

  @param scheme - the applied color scheme
  @param namespace - the namespace
*/
export function getScale(colorScheme?: string, namespace?: string) {
  return getNamespace(namespace).getScale(colorScheme);
}
