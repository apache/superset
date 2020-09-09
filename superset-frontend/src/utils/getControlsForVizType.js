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

import memoize from 'lodash/memoize';
import { getChartControlPanelRegistry } from '@superset-ui/core';
import controls from '../explore/controls';

const getControlsForVizType = memoize(vizType => {
  const controlsMap = {};
  getChartControlPanelRegistry()
    .get(vizType)
    .controlPanelSections.forEach(section => {
      section.controlSetRows.forEach(row => {
        row.forEach(control => {
          if (!control) return;
          if (typeof control === 'string') {
            // For now, we have to look in controls.jsx to get the config for some controls.
            // Once everything is migrated out, delete this if statement.
            controlsMap[control] = controls[control];
          } else if (control.name && control.config) {
            // condition needed because there are elements, e.g. <hr /> in some control configs (I'm looking at you, FilterBox!)
            controlsMap[control.name] = control.config;
          }
        });
      });
    });
  return controlsMap;
});

export default getControlsForVizType;
