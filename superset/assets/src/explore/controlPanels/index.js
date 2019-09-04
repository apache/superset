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
/**
 * This file defines how controls (defined in controls.js) are structured into sections
 * and associated with each and every visualization type.
 */
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import * as sections from './sections';
import extraOverrides from './extraOverrides';

export const controlPanelConfigs = extraOverrides(getChartControlPanelRegistry().getMap());

export default controlPanelConfigs;

export function sectionsToRender(vizType, datasourceType) {
  const { sectionOverrides = {}, controlPanelSections = [] } = controlPanelConfigs[vizType] || {};

  const sectionsCopy = { ...sections };

  Object.entries(sectionOverrides).forEach(([section, overrides]) => {
    if (typeof overrides === 'object' && overrides.constructor === Object) {
      sectionsCopy[section] = {
        ...sectionsCopy[section],
        ...overrides,
      };
    } else {
      sectionsCopy[section] = overrides;
    }
  });

  const { datasourceAndVizType, sqlaTimeSeries, druidTimeSeries, filters } = sectionsCopy;

  return [].concat(
    datasourceAndVizType,
    datasourceType === 'table' ? sqlaTimeSeries : druidTimeSeries,
    isFeatureEnabled(FeatureFlag.SCOPED_FILTER) ? filters : undefined,
    controlPanelSections,
  ).filter(section => section);
}
