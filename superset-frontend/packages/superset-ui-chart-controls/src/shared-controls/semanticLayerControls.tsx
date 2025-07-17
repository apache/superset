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
  dndAdhocMetricsControl,
  dndAdhocMetricControl,
  dndAdhocMetricControl2,
  dndGroupByControl,
  dndColumnsControl,
} from './dndControls';
// Placeholder for semantic layer controls - these would be imported from the main app
const semanticLayerDndAdhocMetricsControl = null;
const semanticLayerDndAdhocMetricControl = null;
const semanticLayerDndAdhocMetricControl2 = null;
const semanticLayerDndGroupByControl = null;
const semanticLayerDndColumnsControl = null;

/**
 * Enhanced shared controls that include semantic layer verification
 * when using compatible datasources.
 */
export const enhancedSharedControls = {
  // Original controls
  dndAdhocMetricsControl,
  dndAdhocMetricControl,
  dndAdhocMetricControl2,
  dndGroupByControl,
  dndColumnsControl,

  // Enhanced controls with semantic layer verification
  semanticLayerDndAdhocMetricsControl,
  semanticLayerDndAdhocMetricControl,
  semanticLayerDndAdhocMetricControl2,
  semanticLayerDndGroupByControl,
  semanticLayerDndColumnsControl,
};

/**
 * Get the appropriate control based on datasource capabilities
 */
export function getSemanticLayerControl(
  controlName: string,
  datasource?: any,
): any {
  // Check if datasource supports semantic layer verification
  const supportsSemanticLayer =
    datasource &&
    'database' in datasource &&
    datasource.database?.engine_information?.supports_dynamic_columns;

  if (supportsSemanticLayer) {
    switch (controlName) {
      case 'dndAdhocMetricsControl':
        return semanticLayerDndAdhocMetricsControl;
      case 'dndAdhocMetricControl':
        return semanticLayerDndAdhocMetricControl;
      case 'dndAdhocMetricControl2':
        return semanticLayerDndAdhocMetricControl2;
      case 'dndGroupByControl':
        return semanticLayerDndGroupByControl;
      case 'dndColumnsControl':
        return semanticLayerDndColumnsControl;
      default:
        break;
    }
  }

  // Return original control for non-semantic layer datasources
  switch (controlName) {
    case 'dndAdhocMetricsControl':
      return dndAdhocMetricsControl;
    case 'dndAdhocMetricControl':
      return dndAdhocMetricControl;
    case 'dndAdhocMetricControl2':
      return dndAdhocMetricControl2;
    case 'dndGroupByControl':
      return dndGroupByControl;
    case 'dndColumnsControl':
      return dndColumnsControl;
    default:
      return null;
  }
}
