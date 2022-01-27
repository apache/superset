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
import { ColumnMeta, SelectControlConfig } from '../types';
import { dndColumnsControl, dndEntity } from './dndControls';
export declare const PRIMARY_COLOR: {
    r: number;
    g: number;
    b: number;
    a: number;
};
declare const sharedControls: {
    metrics: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    metric: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    datasource: import("../types").BaseControlConfig<"DatasourceControl", import("../types").SelectOption, import("@superset-ui/core").JsonValue>;
    viz_type: import("../types").BaseControlConfig<"VizTypeControl", import("../types").SelectOption, import("@superset-ui/core").JsonValue>;
    color_picker: import("../types").BaseControlConfig<"ColorPickerControl", import("../types").SelectOption, import("@superset-ui/core").JsonValue>;
    metric_2: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    linear_color_scheme: import("../types").BaseControlConfig<"ColorSchemeControl", import("../types").SelectOption, import("@superset-ui/core").JsonValue>;
    secondary_metric: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    groupby: import("../types").BaseControlConfig<"DndColumnSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<ColumnMeta, "SelectControl">;
    columns: import("../types").BaseControlConfig<"DndColumnSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<ColumnMeta, "SelectControl">;
    druid_time_origin: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    granularity: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    granularity_sqla: import("../types").BaseControlConfig<"DndColumnSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<ColumnMeta, "SelectControl">;
    time_grain_sqla: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    time_range: import("../types").BaseControlConfig<"DateFilterControl", import("../types").SelectOption, import("@superset-ui/core").JsonValue>;
    row_limit: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    limit: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    timeseries_limit_metric: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    orderby: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    series: import("../types").BaseControlConfig<"DndColumnSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<ColumnMeta, "SelectControl">;
    entity: import("../types").BaseControlConfig<"DndColumnSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<ColumnMeta, "SelectControl">;
    x: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    y: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    size: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    y_axis_format: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    x_axis_time_format: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    adhoc_filters: import("../types").BaseControlConfig<"DndFilterSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "AdhocFilterControl">;
    color_scheme: import("../types").BaseControlConfig<"ColorSchemeControl", import("../types").SelectOption, import("@superset-ui/core").JsonValue>;
    series_columns: import("../types").BaseControlConfig<"DndColumnSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<ColumnMeta, "SelectControl">;
    series_limit: SelectControlConfig<import("../types").SelectOption, "SelectControl">;
    series_limit_metric: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
    legacy_order_by: import("../types").BaseControlConfig<"DndMetricSelect", import("../types").SelectOption, import("@superset-ui/core").JsonValue> | SelectControlConfig<import("../types").SelectOption, "MetricsControl">;
};
export { sharedControls, dndEntity, dndColumnsControl };
//# sourceMappingURL=index.d.ts.map