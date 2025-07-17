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
  Dataset,
} from '@superset-ui/chart-controls';
import withAsyncVerification from './withAsyncVerification';
import {
  createMetricsVerification,
  createColumnsVerification,
  createSemanticLayerOnChange,
  SEMANTIC_LAYER_CONTROL_FIELDS,
} from './SemanticLayerVerification';

/**
 * Check if a datasource supports semantic layer verification
 */
function needsSemanticLayerVerification(datasource: Dataset): boolean {
  if (!datasource || !('database' in datasource) || !datasource.database) {
    return false;
  }

  const database = datasource.database as any;
  return Boolean(database.engine_information?.supports_dynamic_columns);
}

/**
 * Enhanced metrics control with semantic layer verification
 */
export const semanticLayerDndAdhocMetricsControl = {
  ...dndAdhocMetricsControl,
  type: withAsyncVerification({
    baseControl: 'DndMetricSelect',
    verify: createMetricsVerification(),
    onChange: createSemanticLayerOnChange(
      'metrics',
      SEMANTIC_LAYER_CONTROL_FIELDS,
    ),
    showLoadingState: true,
  }),
  mapStateToProps: (state: any, controlState: any) => {
    // Call the original mapStateToProps if it exists
    const originalProps = dndAdhocMetricsControl.mapStateToProps
      ? dndAdhocMetricsControl.mapStateToProps(state, controlState)
      : {};

    return {
      ...originalProps,
      needAsyncVerification: needsSemanticLayerVerification(state.datasource),
      form_data: state.form_data,
    };
  },
};

/**
 * Enhanced single metric control with semantic layer verification
 */
export const semanticLayerDndAdhocMetricControl = {
  ...dndAdhocMetricControl,
  type: withAsyncVerification({
    baseControl: 'DndMetricSelect',
    verify: createMetricsVerification(),
    onChange: createSemanticLayerOnChange(
      'metric',
      SEMANTIC_LAYER_CONTROL_FIELDS,
    ),
    showLoadingState: true,
  }),
  mapStateToProps: (state: any, controlState: any) => {
    // Call the original mapStateToProps if it exists
    const originalProps = dndAdhocMetricControl.mapStateToProps
      ? dndAdhocMetricControl.mapStateToProps(state, controlState)
      : {};

    return {
      ...originalProps,
      needAsyncVerification: needsSemanticLayerVerification(state.datasource),
      form_data: state.form_data,
    };
  },
};

/**
 * Enhanced secondary metric control with semantic layer verification
 */
export const semanticLayerDndAdhocMetricControl2 = {
  ...dndAdhocMetricControl2,
  type: withAsyncVerification({
    baseControl: 'DndMetricSelect',
    verify: createMetricsVerification(),
    onChange: createSemanticLayerOnChange(
      'metric_2',
      SEMANTIC_LAYER_CONTROL_FIELDS,
    ),
    showLoadingState: true,
  }),
  mapStateToProps: (state: any, controlState: any) => {
    // Call the original mapStateToProps if it exists
    const originalProps = dndAdhocMetricControl2.mapStateToProps
      ? dndAdhocMetricControl2.mapStateToProps(state, controlState)
      : {};

    return {
      ...originalProps,
      needAsyncVerification: needsSemanticLayerVerification(state.datasource),
      form_data: state.form_data,
    };
  },
};

/**
 * Enhanced group by control with semantic layer verification
 */
export const semanticLayerDndGroupByControl = {
  ...dndGroupByControl,
  type: withAsyncVerification({
    baseControl: 'DndColumnSelect',
    verify: createColumnsVerification(),
    onChange: createSemanticLayerOnChange(
      'groupby',
      SEMANTIC_LAYER_CONTROL_FIELDS,
    ),
    showLoadingState: true,
  }),
  mapStateToProps: (state: any, controlState: any) => {
    // Call the original mapStateToProps if it exists
    const originalProps = dndGroupByControl.mapStateToProps
      ? dndGroupByControl.mapStateToProps(state, controlState)
      : {};

    return {
      ...originalProps,
      needAsyncVerification: needsSemanticLayerVerification(state.datasource),
      form_data: state.form_data,
    };
  },
};

/**
 * Enhanced columns control with semantic layer verification
 */
export const semanticLayerDndColumnsControl = {
  ...dndColumnsControl,
  type: withAsyncVerification({
    baseControl: 'DndColumnSelect',
    verify: createColumnsVerification(),
    onChange: createSemanticLayerOnChange(
      'columns',
      SEMANTIC_LAYER_CONTROL_FIELDS,
    ),
    showLoadingState: true,
  }),
  mapStateToProps: (state: any, controlState: any) => {
    // Call the original mapStateToProps if it exists
    const originalProps = dndColumnsControl.mapStateToProps
      ? dndColumnsControl.mapStateToProps(state, controlState)
      : {};

    return {
      ...originalProps,
      needAsyncVerification: needsSemanticLayerVerification(state.datasource),
      form_data: state.form_data,
    };
  },
};

/**
 * Create override function for semantic layer controls
 */
function createSemanticLayerControlOverride(enhancedControl: any) {
  return (originalConfig: any) =>
    // For semantic layer datasources, use the enhanced control
    // For regular datasources, use the original control
    ({
      ...originalConfig,
      ...enhancedControl,
    });
}

/**
 * Control overrides mapping
 */
export const semanticLayerControlOverrides = {
  metrics: createSemanticLayerControlOverride(
    semanticLayerDndAdhocMetricsControl,
  ),
  metric: createSemanticLayerControlOverride(
    semanticLayerDndAdhocMetricControl,
  ),
  metric_2: createSemanticLayerControlOverride(
    semanticLayerDndAdhocMetricControl2,
  ),
  percent_metrics: createSemanticLayerControlOverride(
    semanticLayerDndAdhocMetricsControl,
  ),
  timeseries_limit_metric: createSemanticLayerControlOverride(
    semanticLayerDndAdhocMetricControl,
  ),
  groupby: createSemanticLayerControlOverride(semanticLayerDndGroupByControl),
  columns: createSemanticLayerControlOverride(semanticLayerDndColumnsControl),
  series_columns: createSemanticLayerControlOverride(
    semanticLayerDndColumnsControl,
  ),
};
